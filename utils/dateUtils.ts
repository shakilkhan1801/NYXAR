export const formatTime = (timestamp: number): string => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(timestamp));
};

export const formatChatListDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < oneDay && now.getDate() === date.getDate()) {
    return formatTime(timestamp);
  }
  if (diff < oneDay * 2) {
    return 'Yesterday';
  }
  if (diff < oneDay * 7) {
    return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
  }
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
};

export const getMessageDateLabel = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (messageDate === today) {
    return 'Today';
  }
  if (messageDate === today - oneDay) {
    return 'Yesterday';
  }
  
  return new Intl.DateTimeFormat('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

export const formatFullDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};