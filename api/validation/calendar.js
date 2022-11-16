const Joi = require('joi');
const { CALENDAR_NAME_LENGTH, CALENDAR_DESCRIPTION_LENGTH, COLOR_PATTERN } = require('~/consts/validation');

const filterSchema = Joi.object().keys({
  calendarIDs: Joi.array().items(Joi.number()),
});

const createSchema = Joi.object().keys({
  name: Joi.string().required().min(CALENDAR_NAME_LENGTH.min).max(CALENDAR_NAME_LENGTH.max),
  description: Joi.string().min(CALENDAR_DESCRIPTION_LENGTH.min).max(CALENDAR_DESCRIPTION_LENGTH.max),
  color: Joi.string().pattern(COLOR_PATTERN, 'color'),
});

const updateSchema = Joi.object().keys({
  name: Joi.string().required().min(CALENDAR_NAME_LENGTH.min).max(CALENDAR_NAME_LENGTH.max),
  description: Joi.string().min(CALENDAR_DESCRIPTION_LENGTH.min).max(CALENDAR_DESCRIPTION_LENGTH.max), //? required
  color: Joi.string().required().pattern(COLOR_PATTERN, 'color'),
});

const shareSchema = Joi.object().keys({
  email: Joi.string().email().required(),
});

module.exports = { filterSchema, createSchema, shareSchema, updateSchema };