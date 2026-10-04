import sharp from "sharp";
import path from "path";

export const preprocessReceiptImage = async (imagePath) => {
  const extension = path.extname(imagePath);
  const outputPath = imagePath.replace(
    extension,
    "-processed.png"
  );

  await sharp(imagePath)
    .rotate()
    .resize({
      width: 2000,
      withoutEnlargement: false,
    })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toFile(outputPath);

  console.log("Processed receipt image:", outputPath);

  return outputPath;
};