import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

// Usage: swift render-icon.swift source.png destination.png
// Keep 16 px transparent padding around a 96 px mark in a 128 px icon.
let arguments = CommandLine.arguments
if arguments.count != 3 {
    fatalError("Usage: swift render-icon.swift source.png destination.png")
}
let input = URL(fileURLWithPath: arguments[1])
let output = URL(fileURLWithPath: arguments[2])
guard let source = CGImageSourceCreateWithURL(input as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
      let space = CGColorSpace(name: CGColorSpace.sRGB),
      let context = CGContext(data: nil, width: 128, height: 128,
          bitsPerComponent: 8, bytesPerRow: 128 * 4, space: space,
          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
    fatalError("Could not read the source icon or create the drawing context")
}
context.interpolationQuality = .high
context.clear(CGRect(x: 0, y: 0, width: 128, height: 128))
context.draw(image, in: CGRect(x: 16, y: 16, width: 96, height: 96))
guard let result = context.makeImage(),
      let destination = CGImageDestinationCreateWithURL(
          output as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    fatalError("Could not create the output PNG")
}
CGImageDestinationAddImage(destination, result, nil)
if !CGImageDestinationFinalize(destination) { fatalError("Could not save PNG") }
print("Saved \(output.path)")
