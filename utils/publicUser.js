const toPublicUser = (user) => ({
  name: user.name,
  email: user.email,
  studentType: user.studentType || null,
  rollNumber: user.rollNumber || null,
  participantId: user.participantId || null,
  role: user.roles,
  collegeName: user.collegeName || null,
  accommodation: !!user.accommodation,
  registrationType: user.registrationType,
  teamMembers: user.teamMembers || [],
  events: user.events || [],
  idDocumentUrl: user.idDocumentUrl,
  paymentScreenshotUrl: user.paymentScreenshotUrl,
  registrationNum: user.registrationNum,
});

module.exports = { toPublicUser };
