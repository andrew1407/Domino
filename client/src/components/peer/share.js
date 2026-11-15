export const copyText = async text => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export const shareText = async (title, text) => {
  try {
    await navigator.share({ title, text });
    return true;
  } catch {
    return false;
  }
};
