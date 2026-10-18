package expo.modules.cardscanner

import android.app.Activity
import android.content.Context
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID

private const val SCAN_REQUEST_CODE = 0xCA4D

/**
 * Scans a business card with ML Kit's document scanner, which finds the card's
 * edges and captures it automatically, then recognises its text on the device
 * with ML Kit Text Recognition.
 */
class CardScannerModule : Module() {
  /** The scan waiting for the scanner activity to return. */
  private var pendingScan: Promise? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("CardScannerModule")

    // Resolves with the file address of the captured card, or null when the Holder cancels.
    AsyncFunction("scanCardAsync") { promise: Promise ->
      if (pendingScan != null) {
        promise.reject(ScanInProgressException())
        return@AsyncFunction
      }
      val activity = appContext.throwingActivity
      val options = GmsDocumentScannerOptions.Builder()
        .setPageLimit(1)
        .setGalleryImportAllowed(false)
        .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
        .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
        .build()

      pendingScan = promise
      GmsDocumentScanning.getClient(options)
        .getStartScanIntent(activity)
        .addOnSuccessListener { intentSender ->
          activity.startIntentSenderForResult(intentSender, SCAN_REQUEST_CODE, null, 0, 0, 0)
        }
        .addOnFailureListener { error ->
          pendingScan = null
          // Devices without Google Play services, or with too little memory, can't run the scanner.
          promise.reject(ScannerUnavailableException(error))
        }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != SCAN_REQUEST_CODE) return@OnActivityResult
      val promise = pendingScan ?: return@OnActivityResult
      pendingScan = null

      if (payload.resultCode != Activity.RESULT_OK) {
        promise.resolve(null)
        return@OnActivityResult
      }
      val page = GmsDocumentScanningResult.fromActivityResultIntent(payload.data)?.pages?.firstOrNull()
      if (page == null) {
        promise.resolve(null)
        return@OnActivityResult
      }
      try {
        promise.resolve(copyToCache(page.imageUri).toString())
      } catch (error: Exception) {
        promise.reject(ImageCopyException(error))
      }
    }

    // Resolves with each recognised line and its box as fractions of the image, from the top-left corner.
    AsyncFunction("recogniseTextAsync") { uri: String, promise: Promise ->
      val image = try {
        InputImage.fromFilePath(context, Uri.parse(uri))
      } catch (error: Exception) {
        promise.reject(InvalidImageException(uri, error))
        return@AsyncFunction
      }
      val width = image.width.toDouble()
      val height = image.height.toDouble()

      TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        .process(image)
        .addOnSuccessListener { text ->
          val lines = text.textBlocks.flatMap { block -> block.lines }.mapNotNull { line ->
            val box = line.boundingBox ?: return@mapNotNull null
            mapOf(
              "text" to line.text,
              "box" to mapOf(
                "x" to box.left / width,
                "y" to box.top / height,
                "width" to box.width() / width,
                "height" to box.height() / height
              )
            )
          }
          promise.resolve(lines)
        }
        .addOnFailureListener { error -> promise.reject(TextRecognitionException(error)) }
    }
  }

  /**
   * Copies the scanner's page into the app's own cache, so the app can read it
   * as an ordinary file. The app copies it somewhere durable when the card is saved.
   */
  private fun copyToCache(source: Uri): Uri {
    val destination = File(context.cacheDir, "card-scan-${UUID.randomUUID()}.jpg")
    val input = context.contentResolver.openInputStream(source)
      ?: throw IllegalStateException("The scanner's image at $source couldn't be opened")
    input.use { stream -> destination.outputStream().use { stream.copyTo(it) } }
    return Uri.fromFile(destination)
  }
}

internal class ScannerUnavailableException(cause: Throwable) :
  CodedException("This device can't scan cards with the camera", cause)

internal class ScanInProgressException :
  CodedException("A card is already being scanned")

internal class ImageCopyException(cause: Throwable) :
  CodedException("The scanned card couldn't be saved as an image", cause)

internal class InvalidImageException(uri: String, cause: Throwable) :
  CodedException("'$uri' isn't the address of an image file on this device", cause)

internal class TextRecognitionException(cause: Throwable) :
  CodedException("The card's text couldn't be read", cause)
