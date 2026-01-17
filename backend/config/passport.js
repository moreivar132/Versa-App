/**
 * Passport.js Configuration
 * Google OAuth 2.0 Strategy
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Only configure if credentials are present
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        scope: ['openid', 'email', 'profile'],
        passReqToCallback: true
    }, (req, accessToken, refreshToken, profile, done) => {
        // We don't use Passport's session serialization - we generate JWT instead
        // Just pass the profile to the callback handler
        const userData = {
            provider: 'google',
            providerId: profile.id,
            email: profile.emails?.[0]?.value || null,
            name: profile.displayName || profile.name?.givenName || 'Usuario',
            avatar: profile.photos?.[0]?.value || null,
            accessToken,
            refreshToken
        };

        return done(null, userData);
    }));
} else {
    console.warn('[Passport] Google OAuth not configured - GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing');
}

// We don't use sessions with Passport (stateless JWT), so no serialize/deserialize needed
// But Passport requires them, so provide empty implementations
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

module.exports = passport;
