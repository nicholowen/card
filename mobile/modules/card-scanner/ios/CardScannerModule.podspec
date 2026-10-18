Pod::Spec.new do |s|
  s.name           = 'CardScannerModule'
  s.version        = '1.0.0'
  s.summary        = 'Scans business cards and recognises their text on the device'
  s.description    = 'The system document camera (VisionKit) to capture a card, and Apple Vision to recognise its text.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'VisionKit'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
