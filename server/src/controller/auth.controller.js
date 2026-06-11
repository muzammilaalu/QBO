import OAuthClient from "intuit-oauth";
import config from "../config/qbo.config.js";
import { clearCacheForRealm } from '../config/database.js';

const oauthClient =
  new OAuthClient({
    clientId:
      config.clientId,

    clientSecret:
      config.clientSecret,

    environment:
      config.environment,

    redirectUri:
      config.redirectUri,
  });

const getAuthUrl = (
  req,
  res
) => {
  const authUri =
    oauthClient.authorizeUri({
      scope: [
        OAuthClient.scopes
          .Accounting,
      ],

      state:
        "qbo-auth-state",
    });

  res.json({
    url: authUri,
  });
};
const handleCallback = async (req, res) => {
  try {
    const authResponse = await oauthClient.createToken(
      `${config.redirectUri}?${new URLSearchParams(req.query).toString()}`
    );

    const tokens = authResponse.getJson();

    req.session.accessToken  = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token;
    req.session.realmId      = req.query.realmId;
    req.session.companyName  = 'Production Company';

    req.session.save((err) => {
      if (err) {
       
        return res.status(500).json({ error: 'Session save failed' });
      }

      // ✅ Token ko temporary query param se pass karo
      const tempToken = Buffer.from(JSON.stringify({
        accessToken:  tokens.access_token,
        refreshToken: tokens.refresh_token,
        realmId:      req.query.realmId,
      })).toString('base64');

      res.redirect(`${process.env.FRONTEND_URL}/dashboard?auth=${tempToken}`);
    });

  } catch (err) {
    console.error('❌ Callback error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

const checkAuth = (req, res) => {
 

  const isAuth = !!(req.session?.accessToken && req.session?.realmId);
  res.json({
    isAuthenticated: isAuth,
    companyName: req.session?.companyName || 'Production Company',
    realmId: req.session?.realmId || null,
  });
};

// const logout = (req, res) => {
//   req.session.destroy((err) => {
//     if (err) {
//       return res.status(500).json({ error: 'Logout failed' });
//     }
//     res.clearCookie('connect.sid');
//     res.json({ message: 'Logged out successfully' });
//   });
// };

const logout = (req, res) => {
  const realmId = req.session?.realmId;
  if (realmId) clearCacheForRealm(realmId).catch(console.error);

  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
};

const setSession = (req, res) => {
  const { accessToken, refreshToken, realmId } = req.body;

  if (!accessToken || !realmId) {
    return res.status(400).json({ error: 'Missing token or realmId' });
  }

  req.session.accessToken  = accessToken;
  req.session.refreshToken = refreshToken;
  req.session.realmId      = realmId;
  req.session.companyName  = 'Production Company';

  req.session.save((err) => {
    if (err) {
      return res.status(500).json({ error: 'Session save failed' });
    }
    res.json({ success: true });
  });
};

export {
  getAuthUrl,
  handleCallback,
  checkAuth,
  logout,
  setSession
};