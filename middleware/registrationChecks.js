const NITW_DOMAIN = "nitw.ac.in";

const isNitwEmail = (email) => {
  if (typeof email !== "string") return false;
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2 || !parts[0]) return false;
  const domain = parts[1];
  return domain === NITW_DOMAIN || domain.endsWith("." + NITW_DOMAIN);
};

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dpjrslhwg';

const isOurCloudinaryUrl = (value) => {
    if (typeof value !== 'string' || value.length > 500) return false;
    let url;
    try {
        url = new URL(value);
    } catch {
        return false;
    }
    return (
        url.protocol === 'https:' &&
        url.hostname === 'res.cloudinary.com' &&
        url.pathname.startsWith(`/${CLOUD_NAME}/`)
    );
};

const validateUploads = ({ email, idDocumentUrl, paymentScreenshotUrl, requiresPayment }) => {
    // Fall back to the old lead-only rule if a caller doesn't pass the flag
    const needsPayment = requiresPayment ?? !isNitwEmail(email);

    if (!isOurCloudinaryUrl(idDocumentUrl)) {
        return 'A valid ID document upload is required';
    }
    if (needsPayment && !isOurCloudinaryUrl(paymentScreenshotUrl)) {
        return 'A valid payment screenshot upload is required when any team member is not from NITW';
    }
    return null;
};

module.exports = { isNitwEmail, isOurCloudinaryUrl, validateUploads };
