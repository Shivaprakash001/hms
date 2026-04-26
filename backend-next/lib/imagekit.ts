import ImageKit from "@imagekit/nodejs";

const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || "dummy_key";
const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/dummy";

if (!process.env.IMAGEKIT_PRIVATE_KEY && process.env.NODE_ENV !== "production") {
  console.warn("⚠️ Missing IMAGEKIT_PRIVATE_KEY environment variable.");
}

export const imagekit = new ImageKit({
  privateKey: privateKey,
});

/**
 * URL endpoint is needed for signed URL generation via helper.buildSrc().
 * The new @imagekit/nodejs v7.x SDK no longer accepts it in the constructor.
 */
export const IMAGEKIT_URL_ENDPOINT = urlEndpoint;
