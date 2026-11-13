// Genera el PNG de 1024 px desde el que `pnpm tauri icon` crea todos los iconos de la app.
// Igual que en Mantis: el diseño se dibuja a 824×824 px, centrado con 100 px de margen
// transparente por lado, para que en el Dock se vea del mismo tamaño que los iconos de macOS.
// Uso: swift marca/generar-icono.swift marca/ant-icono.svg marca/ant-icono-1024.png

import AppKit

let args = CommandLine.arguments
guard args.count == 3, let svg = NSImage(contentsOfFile: args[1]) else {
    fatalError("Uso: swift generar-icono.swift entrada.svg salida.png")
}
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 1024, pixelsHigh: 1024, bitsPerSample: 8,
                           samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                           bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSGraphicsContext.current!.imageInterpolation = .high
svg.draw(in: NSRect(x: 100, y: 100, width: 824, height: 824))
NSGraphicsContext.restoreGraphicsState()
try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[2]))
