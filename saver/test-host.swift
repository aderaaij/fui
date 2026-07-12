// Dev harness: loads a .saver bundle the way ScreenSaverEngine would
// (NSBundle → NSPrincipalClass), runs it in a window and snapshots the
// hosted WKWebView so the attract loop can be verified headlessly.
//   swiftc -o test-host saver/test-host.swift \
//     -framework AppKit -framework ScreenSaver -framework WebKit
//   ./test-host <path/to/MUTHUR.saver> <outdir> [t1 t2 ...]
import AppKit
import ScreenSaver
import WebKit

let args = CommandLine.arguments
guard args.count >= 3 else {
  fputs("usage: test-host <bundle.saver> <outdir> [seconds ...]\n", stderr)
  exit(64)
}
let bundlePath = args[1]
let outDir = URL(fileURLWithPath: args[2], isDirectory: true)
let times: [Double] = args.count > 3 ? args[3...].compactMap(Double.init) : [4, 14, 24]

guard let bundle = Bundle(path: bundlePath) else {
  fputs("FAIL: no bundle at \(bundlePath)\n", stderr)
  exit(1)
}
guard bundle.load() else {
  fputs("FAIL: bundle.load() — executable did not link\n", stderr)
  exit(1)
}
guard let saverClass = bundle.principalClass as? ScreenSaverView.Type else {
  fputs("FAIL: principal class is not a ScreenSaverView\n", stderr)
  exit(1)
}
print("LOADED: \(saverClass)")

let app = NSApplication.shared
app.setActivationPolicy(.regular)

let rect = NSRect(x: 0, y: 0, width: 1280, height: 800)
guard let saver = saverClass.init(frame: rect, isPreview: false) else {
  fputs("FAIL: view init returned nil\n", stderr)
  exit(1)
}
let window = NSWindow(
  contentRect: rect, styleMask: [.titled], backing: .buffered, defer: false)
window.title = "saver test host"
window.contentView = saver
window.makeKeyAndOrderFront(nil)
saver.startAnimation()
app.activate(ignoringOtherApps: true)

func findWebView(_ view: NSView) -> WKWebView? {
  if let web = view as? WKWebView { return web }
  for sub in view.subviews {
    if let web = findWebView(sub) { return web }
  }
  return nil
}

for (index, t) in times.enumerated() {
  DispatchQueue.main.asyncAfter(deadline: .now() + t) {
    guard let web = findWebView(saver) else {
      fputs("FAIL: no WKWebView in saver view\n", stderr)
      exit(1)
    }
    web.takeSnapshot(with: nil) { image, error in
      if let image,
        let tiff = image.tiffRepresentation,
        let rep = NSBitmapImageRep(data: tiff),
        let png = rep.representation(using: .png, properties: [:])
      {
        let dest = outDir.appendingPathComponent("saver-\(Int(t))s.png")
        try? png.write(to: dest)
        print("shot \(Int(t))s → \(dest.path)")
      } else {
        print("snapshot \(Int(t))s FAILED: \(error.map(String.init(describing:)) ?? "nil")")
      }
      if index == times.count - 1 { exit(0) }
    }
  }
}

app.run()
