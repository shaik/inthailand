# Am I in Thailand?

A minimal static website that answers one question.

**Live site:** https://shaik.github.io/inthailand/

## How it works

1. Tries the browser Geolocation API first
2. Falls back to GeoIP lookup (via [ipapi.co](https://ipapi.co)) if location is denied or unavailable
3. Shows "Can't tell" if neither method works

No backend. No analytics. No data stored.
