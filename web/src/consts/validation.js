const LOGIN_LENGTH = { min: 4, max: 20 };
const PASSWORD_LENGTH = { min: 8, max: 20 };
const EVENT_NAME_LENGTH = { min: 5, max: 20 };
const CALENDAR_NAME_LENGTH = { min: 5, max: 100 };
const COLOR_PATTERN = /^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/;

const EVENT_TYPE_ENUM = {
  arrangement: 'arrangement',
  reminder: 'reminder',
  task: 'task',
};

const COLOR_DEFAULTS = {
  calendar: '#7399F2',
  // arrangement: '',
  // task: '',
  // reminder: ''
};

export {
  LOGIN_LENGTH,
  PASSWORD_LENGTH,
  EVENT_NAME_LENGTH,
  CALENDAR_NAME_LENGTH,
  COLOR_PATTERN,
  EVENT_TYPE_ENUM,
  COLOR_DEFAULTS,
};
