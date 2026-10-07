const toPublicUser = (user) => ({
  name: user.name,
  email: user.email,
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
