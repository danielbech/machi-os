const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg"];

export function validateImageFile(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File is too large (max 5MB)");
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Invalid file type. Use JPEG, PNG, GIF, WebP, or SVG");
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error("Invalid file extension");
  }
}
