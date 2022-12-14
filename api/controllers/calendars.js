const requestIP = require('request-ip');
const { DEFAULT_HOLIDAY } = require('~/consts/default');
const templates = require('~/consts/email');
const { ROLES } = require('~/consts/validation');
const { checkCalendarAction, checkCalendarName } = require('~/helpers/action-checks');
const { splitParams, getCalendarFilters } = require('~/helpers/filtering');
const { getHolidaysByIP } = require('~/helpers/holiday-api');
const ServerError = require('~/helpers/server-error');
const { reduceToRole, reduceToConfirmed } = require('~/helpers/utils');
const { calendar, user, userCalendars, event } = require('~/lib/prisma');
const { Factory, Email, Token } = require('~/services');

const getCalendars = async (req, res) => {
  const { id } = req.user;

  const roles = splitParams(req.query.roles, String);
  const filters = roles.length ? getCalendarFilters({ roles }) : {};

  const calendars = await calendar.findMany({
    where: {
      users: {
        some: {
          user: { id },
          isConfirmed: true,
          ...filters,
        },
      },
    },
    include: {
      users: {
        select: { role: true },
        where: { userId: id },
      },
    },
  });

  const result = reduceToRole(calendars);

  res.json(result);
};

const getCalendarById = async (req, res) => {
  const id = Number(req.params.id);
  const { id: userId } = req.user;

  await checkCalendarAction(id, userId, Object.values(ROLES));

  const found = await Factory.findOne(calendar, id);

  res.json(found);
};

const getHolidays = async (req, res) => {
  const ip = requestIP.getClientIp(req);
  const holidays = await getHolidaysByIP(ip);

  const data = holidays.map(DEFAULT_HOLIDAY);

  res.json(data);
};

const createCalendar = async (req, res) => {
  const data = req.body;
  const { id } = req.user;

  checkCalendarName(data.name);

  const newCalendar = await calendar.create({
    data: {
      ...data,
      users: {
        create: [
          {
            user: { connect: { id } },
            role: ROLES.admin,
          },
        ],
      },
    },
  });

  res.status(201).json(newCalendar);
};

const updateCalendar = async (req, res) => {
  const data = req.body;
  const calendarId = Number(req.params.id);
  const userId = req.user.id;

  await checkCalendarAction(calendarId, userId, [ROLES.admin]);
  checkCalendarName(data.name);

  const updatedCalendar = await calendar.update({
    where: { id: calendarId },
    data,
  });

  res.status(201).json(updatedCalendar);
};

const deleteCalendar = async (req, res) => {
  const calendarId = Number(req.params.id);
  const userId = req.user.id;

  await checkCalendarAction(calendarId, userId, [ROLES.admin]);

  await event.deleteMany({
    where: {
      calendars: {
        some: { calendarId },
      },
    },
  });

  const deletedCalendar = await calendar.delete({
    where: { id: calendarId },
  });

  res.json(deletedCalendar);
};

const getInvitedUsers = async (req, res) => {
  const id = Number(req.params.id);
  const userId = req.user.id;

  await checkCalendarAction(id, userId, Object.values(ROLES));

  const users = await user.findMany({
    where: {
      id: { not: userId },
      calendars: {
        some: {
          calendar: { id },
        },
      },
    },
    include: {
      calendars: {
        where: { calendarId: id },
        select: { isConfirmed: true },
      },
    },
  });

  const result = reduceToConfirmed(users, 'calendars');

  res.json(result);
};

const getNotInvitedUsers = async (req, res) => {
  const id = Number(req.params.id);
  const userId = req.user.id;

  await checkCalendarAction(id, userId, Object.values(ROLES));

  const users = await user.findMany({
    where: {
      NOT: {
        calendars: {
          some: {
            calendarId: id,
          },
        },
      },
    },
    select: { id: true, email: true },
  });

  res.json(users);
};

const shareCalendar = async (req, res) => {
  const calendarId = Number(req.params.id);
  const { login, id } = req.user;
  const { email } = req.body;

  const { id: userId } = await Factory.exists(user, { email });

  await checkCalendarAction(calendarId, id, [ROLES.admin]);

  const exists = await userCalendars.findUnique({
    where: {
      userId_calendarId: { calendarId, userId },
    },
  });
  if (exists) {
    throw new ServerError(400, 'This user already has access to the calendar.');
  }

  await Factory.update(user, userId, {
    calendars: {
      create: {
        role: ROLES.moderator,
        isConfirmed: false,
        calendar: {
          connect: { id: calendarId },
        },
      },
    },
  });

  const token = Token.generateConfirmToken({ userId, calendarId });
  await Email.sendMail(email, templates.CALENDAR_INVITE_CONFIRM, { login, token });

  res.sendStatus(204);
};

const confirmCalendar = async (req, res) => {
  const { token } = req.params;
  const data = Token.validate(token);

  if (!data || !data.calendarId || !data.userId) {
    throw new ServerError(400, 'The confirm token is invalid.');
  }
  const { userId, calendarId } = data;

  await userCalendars.update({
    where: {
      userId_calendarId: { userId, calendarId },
    },
    data: { isConfirmed: true },
  });

  const events = await event.findMany({
    where: {
      calendars: {
        some: {
          calendarId,
        },
      },
    },
  });

  await Promise.all(
    events.map(({ id }) =>
      Factory.update(user, userId, {
        events: {
          create: {
            role: ROLES.guest,
            event: {
              connect: { id },
            },
          },
        },
      }),
    ),
  );

  res.sendStatus(204);
};

module.exports = {
  getCalendars,
  getCalendarById,
  getHolidays,
  createCalendar,
  updateCalendar,
  deleteCalendar,
  shareCalendar,
  confirmCalendar,
  getInvitedUsers,
  getNotInvitedUsers,
};
