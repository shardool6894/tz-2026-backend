const mongoose = require('mongoose');
const Event = require('../models/Event');
const User = require('../models/User');
const { parseTeamSizeLimits } = require('../utils/teamSize');
const { toPublicUser } = require('../utils/publicUser');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const idStr = (v) => String(v && v._id ? v._id : v);

const pickPerson = (user) => {
  if (!user) return null;
  return {
    id: idStr(user),
    name: user.name || '',
    email: user.email || '',
  };
};

const loadEvent = async (eventId) => {
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return { error: { status: 400, message: 'Invalid event id' } };
  }
  const event = await Event.findById(eventId);
  if (!event) {
    return { error: { status: 404, message: 'Event not found' } };
  }
  if (!Array.isArray(event.users)) event.users = [];
  if (!Array.isArray(event.teams)) event.teams = [];
  return { event };
};

const findTeamByLeader = (event, leaderId) =>
  event.teams.find((t) => idStr(t.leader) === idStr(leaderId));

const findTeamForMember = (event, userId) =>
  event.teams.find((t) => (t.members || []).some((m) => idStr(m) === idStr(userId)));

const findIncomingInvite = (event, userId) => {
  for (const team of event.teams) {
    const pending = (team.pendingInvites || []).find((p) => idStr(p.invitee) === idStr(userId));
    if (pending) return { team, pending };
  }
  return null;
};

const teamHeadcount = (team) =>
  1 + (team.members || []).length + (team.pendingInvites || []).length;

const ensureLeaderTeam = (event, leaderId) => {
  let team = findTeamByLeader(event, leaderId);
  if (!team) {
    event.teams.push({
      leader: leaderId,
      members: [],
      pendingInvites: [],
    });
    team = event.teams[event.teams.length - 1];
  }
  if (!Array.isArray(team.members)) team.members = [];
  if (!Array.isArray(team.pendingInvites)) team.pendingInvites = [];
  return team;
};

const userRegisteredForEvent = (user, eventId) =>
  (user.events || []).some((e) => idStr(e) === idStr(eventId));

const populateTeamPeople = async (event, team) => {
  const ids = [
    team.leader,
    ...(team.members || []),
    ...(team.pendingInvites || []).map((p) => p.invitee),
  ].filter(Boolean);
  const users = await User.find({ _id: { $in: ids } })
    .select('name email')
    .lean();
  const byId = new Map(users.map((u) => [idStr(u._id), u]));

  const leader = pickPerson(byId.get(idStr(team.leader)));
  const members = (team.members || []).map((m) => pickPerson(byId.get(idStr(m)))).filter(Boolean);
  const pendingOutgoing = (team.pendingInvites || [])
    .map((p) => pickPerson(byId.get(idStr(p.invitee))))
    .filter(Boolean);

  return { leader, members, pendingOutgoing };
};

const applyTeamCapacity = (payload) => {
  const max = payload.limits.max;
  const headcount =
    1 + (payload.members || []).length + (payload.pendingOutgoing || []).length;
  payload.teamFull = headcount >= max;
  payload.slotsRemaining = Math.max(0, max - headcount);
  payload.canInvite =
    payload.registered &&
    payload.role === 'leader' &&
    !payload.limits.isIndividual &&
    !payload.teamFull;
  return payload;
};

const buildTeamState = async (event, user) => {
  const limits = parseTeamSizeLimits(event.teamSize);
  const registered = userRegisteredForEvent(user, event._id);
  const asLeader = findTeamByLeader(event, user._id);
  const asMember = findTeamForMember(event, user._id);
  const incoming = findIncomingInvite(event, user._id);

  let role = null;
  if (asLeader) role = 'leader';
  else if (asMember) role = 'member';
  else if (registered && !limits.isIndividual && !incoming) role = 'leader';

  const payload = {
    registered,
    role,
    limits,
    canInvite: false,
    teamFull: false,
    slotsRemaining: limits.max,
    leader: null,
    members: [],
    pendingOutgoing: [],
    pendingIncoming: null,
  };

  if (incoming && !registered) {
    const leaderUser = await User.findById(incoming.team.leader).select('name email').lean();
    payload.pendingIncoming = {
      leader: pickPerson(leaderUser),
    };
    return applyTeamCapacity(payload);
  }

  if (asLeader) {
    const populated = await populateTeamPeople(event, asLeader);
    payload.leader = populated.leader;
    payload.members = populated.members;
    payload.pendingOutgoing = populated.pendingOutgoing;
    return applyTeamCapacity(payload);
  }

  if (registered && role === 'leader' && !asLeader) {
    payload.leader = pickPerson(user);
    return applyTeamCapacity(payload);
  }

  if (asMember) {
    const team = asMember;
    const populated = await populateTeamPeople(event, team);
    payload.leader = populated.leader;
    payload.members = populated.members;
    return applyTeamCapacity(payload);
  }

  return applyTeamCapacity(payload);
};

const getEventTeam = async (req, res) => {
  try {
    const { eventId } = req.params;
    const loaded = await loadEvent(eventId);
    if (loaded.error) {
      return res.status(loaded.error.status).json({ message: loaded.error.message });
    }
    const state = await buildTeamState(loaded.event, req.user);
    res.json({ team: state });
  } catch (err) {
    console.error('getEventTeam error:', err);
    res.status(500).json({ message: 'Could not load team details' });
  }
};

const sendTeamInvite = async (req, res) => {
  try {
    const { eventId } = req.params;
    const email = normalizeEmail(req.body && req.body.email);
    if (!email) {
      return res.status(400).json({ message: 'Enter a valid email address' });
    }

    const loaded = await loadEvent(eventId);
    if (loaded.error) {
      return res.status(loaded.error.status).json({ message: loaded.error.message });
    }
    const { event } = loaded;
    const limits = parseTeamSizeLimits(event.teamSize);
    if (limits.isIndividual) {
      return res.status(400).json({ message: 'This event is individual participation only' });
    }

    if (!userRegisteredForEvent(req.user, event._id)) {
      return res.status(403).json({ message: 'Register for this event before inviting teammates' });
    }

    let team = findTeamByLeader(event, req.user._id);
    if (!team) {
      if (findTeamForMember(event, req.user._id)) {
        return res.status(403).json({ message: 'Only the team leader can send invites' });
      }
      team = ensureLeaderTeam(event, req.user._id);
    }

    const invitee = await User.findOne({
      email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') },
    }).select('_id name email events');
    if (!invitee) {
      return res.status(404).json({ message: 'No registered user found with that email' });
    }
    if (idStr(invitee._id) === idStr(req.user._id)) {
      return res.status(400).json({ message: 'You cannot invite yourself' });
    }
    if (userRegisteredForEvent(invitee, event._id)) {
      return res.status(400).json({ message: 'That user is already registered for this event' });
    }
    if (findTeamByLeader(event, invitee._id)) {
      return res.status(400).json({ message: 'That user is already leading a team for this event' });
    }
    if (findTeamForMember(event, invitee._id)) {
      return res.status(400).json({ message: 'That user is already on a team for this event' });
    }
    const inviteePending = findIncomingInvite(event, invitee._id);
    if (inviteePending) {
      return res.status(400).json({ message: 'That user already has a pending team invite for this event' });
    }
    if ((team.members || []).some((m) => idStr(m) === idStr(invitee._id))) {
      return res.status(400).json({ message: 'That user is already on your team' });
    }
    if ((team.pendingInvites || []).some((p) => idStr(p.invitee) === idStr(invitee._id))) {
      return res.status(400).json({ message: 'An invite is already pending for that user' });
    }
    if (teamHeadcount(team) >= limits.max) {
      return res.status(400).json({ message: `Team is full (maximum ${limits.max} participants)` });
    }

    team.pendingInvites.push({ invitee: invitee._id, invitedAt: new Date() });
    await event.save();

    const state = await buildTeamState(event, req.user);
    res.json({
      message: 'Team invite sent',
      team: state,
    });
  } catch (err) {
    console.error('sendTeamInvite error:', err);
    res.status(500).json({ message: 'Could not send team invite' });
  }
};

const acceptTeamInvite = async (req, res) => {
  try {
    const { eventId } = req.params;
    const loaded = await loadEvent(eventId);
    if (loaded.error) {
      return res.status(loaded.error.status).json({ message: loaded.error.message });
    }
    const { event } = loaded;

    if (!event.registrationOpen) {
      return res.status(400).json({ message: 'Registration for this event is closed' });
    }

    if (userRegisteredForEvent(req.user, event._id)) {
      return res.status(400).json({ message: 'You are already registered for this event' });
    }

    const incoming = findIncomingInvite(event, req.user._id);
    if (!incoming) {
      return res.status(404).json({ message: 'No pending team invite found for this event' });
    }

    const { team } = incoming;
    const limits = parseTeamSizeLimits(event.teamSize);
    const withoutPending = (team.pendingInvites || []).filter(
      (p) => idStr(p.invitee) !== idStr(req.user._id)
    );
    const projected = 1 + (team.members || []).length + 1;
    if (projected > limits.max) {
      return res.status(400).json({ message: 'This team is already full' });
    }

    team.pendingInvites = withoutPending;
    team.members.push(req.user._id);

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { events: event._id },
    });
    if (!event.users.some((u) => idStr(u) === idStr(req.user._id))) {
      event.users.push(req.user._id);
    }

    await event.save();

    const freshUser = await User.findById(req.user._id).select('-password');
    const state = await buildTeamState(event, freshUser);

    res.json({
      message: 'You joined the team and were registered for this event',
      user: toPublicUser(freshUser),
      team: state,
    });
  } catch (err) {
    console.error('acceptTeamInvite error:', err);
    res.status(500).json({ message: 'Could not accept team invite' });
  }
};

const declineTeamInvite = async (req, res) => {
  try {
    const { eventId } = req.params;
    const loaded = await loadEvent(eventId);
    if (loaded.error) {
      return res.status(loaded.error.status).json({ message: loaded.error.message });
    }
    const { event } = loaded;

    const incoming = findIncomingInvite(event, req.user._id);
    if (!incoming) {
      return res.status(404).json({ message: 'No pending team invite found for this event' });
    }

    incoming.team.pendingInvites = (incoming.team.pendingInvites || []).filter(
      (p) => idStr(p.invitee) !== idStr(req.user._id)
    );
    await event.save();

    const state = await buildTeamState(event, req.user);
    res.json({ message: 'Team invite declined', team: state });
  } catch (err) {
    console.error('declineTeamInvite error:', err);
    res.status(500).json({ message: 'Could not decline team invite' });
  }
};

/** Create leader roster when user registers and is not joining via invite. */
const attachUserToEventRegistration = async (eventId, userId) => {
  const loaded = await loadEvent(eventId);
  if (loaded.error) return;
  const { event } = loaded;
  const uid = idStr(userId);

  if (!event.users.some((u) => idStr(u) === uid)) {
    event.users.push(userId);
  }

  const limits = parseTeamSizeLimits(event.teamSize);
  const onTeam = findTeamForMember(event, userId) || findTeamByLeader(event, userId);
  if (!onTeam && !limits.isIndividual) {
    ensureLeaderTeam(event, userId);
  }

  await event.save();
};

module.exports = {
  getEventTeam,
  sendTeamInvite,
  acceptTeamInvite,
  declineTeamInvite,
  attachUserToEventRegistration,
  ensureLeaderTeam,
  parseTeamSizeLimits,
};
