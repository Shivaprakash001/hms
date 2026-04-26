import ImageKit from "@imagekit/nodejs";

if (!process.env.IMAGEKIT_PRIVATE_KEY) {
  throw new Error("Missing IMAGEKIT_PRIVATE_KEY");
}

if (!process.env.IMAGEKIT_URL_ENDPOINT) {
  throw new Error("Missing IMAGEKIT_URL_ENDPOINT");
}

export const imagekit = new ImageKit({
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
});

/**
 * URL endpoint is needed for signed URL generation via helper.buildSrc().
 * The new @imagekit/nodejs v7.x SDK no longer accepts it in the constructor.
 */
export const IMAGEKIT_URL_ENDPOINT = process.env.IMAGEKIT_URL_ENDPOINT;
