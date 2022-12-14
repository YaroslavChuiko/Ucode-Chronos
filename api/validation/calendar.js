const Joi = require('joi');
const { CALENDAR_NAME_LENGTH, CALENDAR_DESCRIPTION_LENGTH, COLOR_PATTERN } = require('~/consts/validation');

const createSchema = Joi.object().keys({
  name: Joi.string().required().min(CALENDAR_NAME_LENGTH.min).max(CALENDAR_NAME_LENGTH.max),
  description: Joi.string().allow('').min(CALENDAR_DESCRIPTION_LENGTH.min).max(CALENDAR_DESCRIPTION_LENGTH.max),
  color: Joi.string().pattern(COLOR_PATTERN, 'color'),
});

const updateSchema = Joi.object().keys({
  name: Joi.string().required().min(CALENDAR_NAME_LENGTH.min).max(CALENDAR_NAME_LENGTH.max),
  description: Joi.string().allow('').min(CALENDAR_DESCRIPTION_LENGTH.min).max(CALENDAR_DESCRIPTION_LENGTH.max),
  color: Joi.string().required().pattern(COLOR_PATTERN, 'color'),
});

const shareSchema = Joi.object().keys({
  email: Joi.string().email().required(),
});

module.exports = { createSchema, shareSchema, updateSchema };
