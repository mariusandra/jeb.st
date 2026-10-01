// jeb.st was the old name: send every request there to the same path on jev.st. GET/HEAD get a 301; anything else a 308
// so a POST to the board API stays a POST. The #hash route never reaches the server, and browsers carry it across.
const OLD = new Set(["jeb.st", "www.jeb.st"]);

export const onRequest = ({ request, next }) => {
  const url = new URL(request.url);
  if (!OLD.has(url.hostname)) return next();
  url.hostname = "jev.st";
  return Response.redirect(url.toString(), ["GET", "HEAD"].includes(request.method) ? 301 : 308);
};
