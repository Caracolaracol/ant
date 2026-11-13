// Genera el PNG de 1024 px desde el que `pnpm tauri icon` crea todos los iconos de la app.
//
// Arma el icono con las capas que escribe `generar-svg.py` en `marca/capas/`:
//   1. fondo.svg — el cuadrado redondeado de fondo;
//   2. interior.svg — el abdomen completo sin recortar, que aquí se difumina con Core Image
//      (el desenfoque de SVG de macOS sale pixelado o se ignora);
//   3. silueta.svg — el contorno del abdomen, que recorta el interior ya difuminado, así la
//      silueta queda nítida.
// El desenfoque usa el valor de `capas/difuminado.txt` (en unidades del lienzo de 64).
//
// Igual que en Mantis: el diseño se dibuja a 824×824 px, centrado con 100 px de margen
// transparente por lado, para que en el Dock se vea del mismo tamaño que los iconos de macOS.
// Con un tercer argumento se cambia el tamaño total (útil para vistas previas); el margen se
// escala en proporción.
//
// Uso: swift marca/generar-icono.swift marca/capas marca/ant-icono-1024.png [tamaño]

import AppKit
import CoreImage

let args = CommandLine.arguments
guard args.count >= 3 else { fatalError("Uso: swift generar-icono.swift carpeta-capas salida.png [tamaño]") }
let carpeta = URL(fileURLWithPath: args[1])
let total = args.count > 3 ? Int(args[3])! : 1024
let margen = total * 100 / 1024
let lado = total - 2 * margen

/// Dibuja un SVG de la carpeta de capas en una imagen de `lado`×`lado` píxeles.
func dibujar(_ nombre: String) -> CIImage {
    guard let svg = NSImage(contentsOf: carpeta.appendingPathComponent(nombre)) else { fatalError("No se pudo leer \(nombre)") }
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: lado, pixelsHigh: lado, bitsPerSample: 8,
                               samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                               bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    NSGraphicsContext.current!.imageInterpolation = .high
    svg.draw(in: NSRect(x: 0, y: 0, width: lado, height: lado))
    NSGraphicsContext.restoreGraphicsState()
    return CIImage(bitmapImageRep: rep)!
}

let fondo = dibujar("fondo.svg")
let interior = dibujar("interior.svg")
let silueta = dibujar("silueta.svg")
let unidades = Double((try? String(contentsOf: carpeta.appendingPathComponent("difuminado.txt"), encoding: .utf8))?
    .trimmingCharacters(in: .whitespacesAndNewlines) ?? "0") ?? 0

// Desenfoque del interior. `clampedToExtent` evita que los bordes de la imagen se aclaren al
// difuminar; después se recorta de vuelta a su tamaño.
let radio = unidades * Double(lado) / 64
let difuso = interior.clampedToExtent()
    .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: radio])
    .cropped(to: interior.extent)

// El interior difuminado se recorta con la silueta (usando su canal alfa como máscara) y se
// pone sobre el fondo.
let compuesto = difuso.applyingFilter("CIBlendWithAlphaMask", parameters: [
    kCIInputBackgroundImageKey: fondo,
    kCIInputMaskImageKey: silueta,
])

// Se coloca centrado en el lienzo final con el margen transparente.
let contexto = CIContext()
guard let cg = contexto.createCGImage(compuesto, from: fondo.extent) else { fatalError("No se pudo componer el icono") }
let salida = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: total, pixelsHigh: total, bitsPerSample: 8,
                              samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                              bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: salida)
NSGraphicsContext.current!.cgContext.draw(cg, in: CGRect(x: margen, y: margen, width: lado, height: lado))
NSGraphicsContext.restoreGraphicsState()
try salida.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[2]))
