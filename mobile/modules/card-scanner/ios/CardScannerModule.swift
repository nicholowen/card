import ExpoModulesCore
import Vision
import VisionKit

/// Scans a business card with the system document camera, which finds the
/// card's edges and captures it automatically, then recognises its text on the
/// device with Apple Vision.
public class CardScannerModule: Module {
  /// Keeps the camera's delegate alive while the camera is showing.
  private var activeScan: DocumentCameraDelegate?

  public func definition() -> ModuleDefinition {
    Name("CardScannerModule")

    /// Resolves with the file address of the captured card, or null when the Holder cancels.
    AsyncFunction("scanCardAsync") { (promise: Promise) in
      guard VNDocumentCameraViewController.isSupported else {
        promise.reject(ScannerUnavailableException())
        return
      }
      guard self.activeScan == nil else {
        promise.reject(ScanInProgressException())
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject(NoViewControllerException())
        return
      }

      let camera = VNDocumentCameraViewController()
      let delegate = DocumentCameraDelegate { [weak self] result in
        camera.dismiss(animated: true)
        self?.activeScan = nil
        switch result {
        case .captured(let image):
          do {
            promise.resolve(try writeToCache(image).absoluteString)
          } catch {
            promise.reject(error)
          }
        case .cancelled:
          promise.resolve(nil)
        case .failed(let error):
          promise.reject(error)
        }
      }
      self.activeScan = delegate
      camera.delegate = delegate
      presenter.present(camera, animated: true)
    }.runOnQueue(.main)

    /// Resolves with each recognised line and its box as fractions of the image, from the top-left corner.
    AsyncFunction("recogniseTextAsync") { (uri: String, promise: Promise) in
      guard let url = URL(string: uri), url.isFileURL else {
        promise.reject(InvalidImageException(uri))
        return
      }

      // Vision can both call back with an error and throw from perform; settle the promise once.
      let settle = Once()
      let request = VNRecognizeTextRequest { request, error in
        guard settle.first() else { return }
        if let error {
          promise.reject(error)
          return
        }
        let observations = request.results as? [VNRecognizedTextObservation] ?? []
        let lines: [[String: Any]] = observations.compactMap { observation in
          guard let text = observation.topCandidates(1).first?.string else { return nil }
          // Vision measures from the bottom-left corner; the app measures from the top-left.
          let box = observation.boundingBox
          return [
            "text": text,
            "box": [
              "x": box.minX,
              "y": 1 - box.maxY,
              "width": box.width,
              "height": box.height,
            ],
          ]
        }
        promise.resolve(lines)
      }
      request.recognitionLevel = .accurate
      // Correction rewrites emails, URLs and unusual names into dictionary words.
      request.usesLanguageCorrection = false

      DispatchQueue.global(qos: .userInitiated).async {
        do {
          // Reading from the file applies its EXIF orientation.
          try VNImageRequestHandler(url: url, options: [:]).perform([request])
        } catch {
          if settle.first() { promise.reject(error) }
        }
      }
    }
  }
}

/// True the first time `first()` is called, false after; safe across threads.
private final class Once: @unchecked Sendable {
  private let lock = NSLock()
  private var done = false

  func first() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    if done { return false }
    done = true
    return true
  }
}

private enum ScanResult {
  case captured(UIImage)
  case cancelled
  case failed(Error)
}

private class DocumentCameraDelegate: NSObject, VNDocumentCameraViewControllerDelegate {
  private let finish: (ScanResult) -> Void

  init(finish: @escaping (ScanResult) -> Void) {
    self.finish = finish
  }

  func documentCameraViewController(
    _ controller: VNDocumentCameraViewController,
    didFinishWith scan: VNDocumentCameraScan
  ) {
    // The camera can capture several pages; the first is the card's front.
    finish(scan.pageCount > 0 ? .captured(scan.imageOfPage(at: 0)) : .cancelled)
  }

  func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
    finish(.cancelled)
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
    finish(.failed(error))
  }
}

/// Writes the captured card to the cache as a JPEG. The app copies it somewhere durable when the card is saved.
private func writeToCache(_ image: UIImage) throws -> URL {
  guard let data = image.jpegData(compressionQuality: 0.85) else {
    throw ImageEncodingException()
  }
  let url = FileManager.default.temporaryDirectory
    .appendingPathComponent("card-scan-\(UUID().uuidString)")
    .appendingPathExtension("jpg")
  try data.write(to: url)
  return url
}

internal final class ScannerUnavailableException: Exception, @unchecked Sendable {
  override var reason: String {
    "This device can't scan cards with the camera: VNDocumentCameraViewController isn't supported here (the iOS simulator never supports it)"
  }
}

internal final class ScanInProgressException: Exception, @unchecked Sendable {
  override var reason: String {
    "A card is already being scanned"
  }
}

internal final class NoViewControllerException: Exception, @unchecked Sendable {
  override var reason: String {
    "There's no screen to show the camera on"
  }
}

internal final class ImageEncodingException: Exception, @unchecked Sendable {
  override var reason: String {
    "The scanned card couldn't be saved as an image"
  }
}

internal final class InvalidImageException: GenericException<String>, @unchecked Sendable {
  override var reason: String {
    "'\(param)' isn't the address of an image file on this device"
  }
}
