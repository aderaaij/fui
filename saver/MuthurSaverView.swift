import ScreenSaver
import WebKit

/// MU/TH/UR 6000 as a macOS screensaver: a WKWebView pointed at the
/// self-contained attract build (Resources/screensaver.html — see
/// saver/build.sh). Everything moves inside the web page; this view only
/// hosts it, so animateOneFrame stays unused and the engine's timer idles.
@objc(MuthurSaverView)
public final class MuthurSaverView: ScreenSaverView {
  public override init?(frame: NSRect, isPreview: Bool) {
    super.init(frame: frame, isPreview: isPreview)
    setup()
  }

  public required init?(coder: NSCoder) {
    super.init(coder: coder)
    setup()
  }

  private func setup() {
    wantsLayer = true
    layer?.backgroundColor = CGColor(red: 0.012, green: 0.024, blue: 0.016, alpha: 1)

    let web = WKWebView(frame: bounds, configuration: WKWebViewConfiguration())
    web.autoresizingMask = [.width, .height]
    // The tube is near-black; make the attach moment match it
    web.underPageBackgroundColor = NSColor(red: 0.012, green: 0.024, blue: 0.016, alpha: 1)
    if let url = Bundle(for: MuthurSaverView.self).url(
      forResource: "screensaver", withExtension: "html")
    {
      web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }
    addSubview(web)
  }

  public override var hasConfigureSheet: Bool { false }
}
