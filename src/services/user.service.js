const prisma = require('../config/db');
const { uploadAvatarImage, deleteAvatarImage } = require('../config/cloudinary');

const updateProfile = async ({ userId, name }) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  return user;
};

const updateAvatar = async ({ userId, buffer }) => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarPublicId: true },
  });

  const uploadResult = await uploadAvatarImage(buffer);

  // Replace, don't accumulate — delete the previous avatar from Cloudinary
  // once the new one is confirmed uploaded.
  if (existingUser.avatarPublicId) {
    await deleteAvatarImage(existingUser.avatarPublicId);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: uploadResult.secure_url, avatarPublicId: uploadResult.public_id },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });

  return user;
};

const removeAvatar = async ({ userId }) => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarPublicId: true },
  });

  if (existingUser.avatarPublicId) {
    await deleteAvatarImage(existingUser.avatarPublicId);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null, avatarPublicId: null },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });

  return user;
};

module.exports = { updateProfile, updateAvatar, removeAvatar };