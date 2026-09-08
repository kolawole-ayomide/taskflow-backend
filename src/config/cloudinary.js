const cloudinary = require('cloudinary').v2;

if (process.env.NODE_ENV !== 'test') {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Uploads a buffer (from multer's memory storage) to Cloudinary, cropped to a
// square avatar. Stubbed out during tests so the surrounding flow (multer
// parsing, DB writes, old-avatar cleanup) is still fully exercised without
// ever making a real network call.
const uploadAvatarImage = (buffer) => {
  if (process.env.NODE_ENV === 'test') {
    const fakeId = `test-avatar-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return Promise.resolve({
      secure_url: `https://res.cloudinary.com/test/image/upload/${fakeId}.png`,
      public_id: fakeId,
    });
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'taskflow/avatars',
        transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

const deleteAvatarImage = (publicId) => {
  if (!publicId) return Promise.resolve();
  if (process.env.NODE_ENV === 'test') return Promise.resolve();

  return cloudinary.uploader.destroy(publicId).catch((error) => {
    // A failed cleanup shouldn't block the user-facing upload/remove action
    console.error(`[cloudinary] Failed to delete ${publicId}:`, error.message);
  });
};

module.exports = { uploadAvatarImage, deleteAvatarImage };