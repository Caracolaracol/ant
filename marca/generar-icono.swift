// Genera el PNG de 1024 px desde el que `pnpm tauri icon` crea todos los iconos de la app.
//
// Igual que en Mantis: el SVG se dibuja tal cual a 824×824 px, centrado con 100 px de margen
// transparente por lado, para que en el Dock se vea del mismo tamaño que los iconos de macOS.
// Con un tercer argumento se cambia el tamaño total (útil para vistas previas); el margen se
// escala en proporción.
//
// Uso: swift marca/generar-icono.swift marca/ant-icono.svg marca/ant-icono-1024.png [tamaño]

import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else { fatalError("Uso: swift generar-icono.swift icono.svg salida.png [tamaño]") }
guard let svg = NSImage(contentsOfFile: args[1]) else { fatalError("No se pudo leer \(args[1])") }
let total = args.count > 3 ? Int(args[3])! : 1024
let margen = total * 100 / 1024

// Lienzo transparente con el diseño centrado dentro del margen.
let salida = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: total, pixelsHigh: total, bitsPerSample: 8,
                              samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                              bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: salida)
NSGraphicsContext.current!.imageInterpolation = .high
svg.draw(in: NSRect(x: margen, y: margen, width: total - 2 * margen, height: total - 2 * margen))
NSGraphicsContext.restoreGraphicsState()
try salida.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[2]))
