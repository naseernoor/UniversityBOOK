const BLOB_DOMAIN_REGEX = /\.blob\.vercel-storage\.com\//i;
const PRIVATE_BLOB_DOMAIN_REGEX = /\.private\.blob\.vercel-storage\.com\//i;

export const isVercelBlobUrl = (value: string) => BLOB_DOMAIN_REGEX.test(value);

export const isPrivateBlobUrl = (value: string) => PRIVATE_BLOB_DOMAIN_REGEX.test(value);

export const toBlobProxyUrl = (blobUrl: string) => `/api/blob?url=${encodeURIComponent(blobUrl)}`;

export const toAssetUrl = (value: string | null | undefined) => {
  if (!value) {
    return value ?? "";
  }

  if (value.startsWith("/api/blob?")) {
    return value;
  }

  if (isPrivateBlobUrl(value)) {
    return toBlobProxyUrl(value);
  }

  return value;
};

export const toBlobUrlForDelete = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  if (isVercelBlobUrl(value)) {
    return value;
  }

  try {
    const parsed = new URL(value, "http://localhost");
    if (parsed.pathname !== "/api/blob") {
      return null;
    }

    const originalUrl = parsed.searchParams.get("url");
    if (!originalUrl || !isVercelBlobUrl(originalUrl)) {
      return null;
    }

    return originalUrl;
  } catch {
    return null;
  }
};
