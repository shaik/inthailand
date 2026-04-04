# Am I in Thailand? — Website Specification

## Overview

**Am I in Thailand?** is a minimal static website intended to be hosted on GitHub Pages.

When a visitor opens the site, it should present a simple face in a neutral state and determine whether the visitor is in Thailand. If the visitor is in Thailand, the site should present a positive result. If the visitor is not in Thailand, the site should present a negative result. If the site cannot determine the visitor’s location, it should present an indeterminate result.

The site must be humorous in concept, but simple and restrained in execution.

## Purpose

The purpose of the website is to provide a lightweight, joke-style experience that answers a single question: whether the visitor is currently in Thailand.

## Hosting and Technical Constraints

- The website must be deployable as a static site on GitHub Pages.
- The website must not require any server-side code.
- The website must run entirely in the browser.
- The website must not depend on a backend controlled by the site owner.
- The website should continue to function gracefully even when precise location access is unavailable.

## Core User Experience Requirements

- The page must revolve around a single question: **Am I in Thailand?**
- On initial load, the site must present a neutral state while it attempts to determine location.
- If the site determines that the visitor is in Thailand, it must present a clear affirmative result.
- If the site determines that the visitor is not in Thailand, it must present a clear negative result.
- If the site cannot determine the visitor’s location, it must present an indeterminate result rather than a misleading answer.
- The experience must remain minimal and focused on this single interaction.

## Location Determination Requirements

The site must determine location using the following priority:

1. **Browser geolocation**, if the visitor allows it.
2. **GeoIP-based location**, as a fallback if browser geolocation is unavailable, denied, or fails.
3. **Indeterminate result**, if neither method can produce a reliable answer.

## Accuracy and Trust Requirements

- Browser geolocation must be treated as the preferred source of truth.
- GeoIP must be treated as an approximate fallback.
- The site must not imply that GeoIP is as accurate as precise device location.
- If no reliable method is available, the site must avoid presenting a confident yes/no answer.

## Result States

The site must support the following user-visible states:

- **Checking**: the site is attempting to determine location.
- **Yes**: the site has determined that the visitor is in Thailand.
- **No**: the site has determined that the visitor is not in Thailand.
- **Can’t tell**: the site could not determine location reliably.

## Facial Expression Requirements

- The page must include a face as the main visual element.
- The face must begin in a neutral expression.
- The face must change to a happy expression when the result is affirmative.
- The face must change to a sad expression when the result is negative.
- The face must remain neutral when the result is indeterminate.

## Interaction Requirements

- The site may ask the user for location permission.
- The site must still provide a coherent experience if the user declines location permission.
- The site should allow the visitor to trigger another location check.

## Content Requirements

- The website should contain very little text beyond the title, the main answer, and minimal supporting copy if needed.
- The tone should remain dry, simple, and understated.
- The humor should come from the premise rather than from heavy copywriting or visual complexity.

## Design Requirements

- The design must be minimalistic.
- The graphics must be simple.
- The page should focus on one central visual and one central answer.
- The design should avoid clutter, decoration, or unrelated content.
- The site should be usable on both desktop and mobile browsers.

## Privacy and Data Handling Requirements

- The site itself must not store visitor location data.
- The site itself must not collect analytics or tracking data as part of this concept.
- If GeoIP is used, the specification should acknowledge that location is inferred through a third-party network-based lookup rather than exact device coordinates.

## Accessibility and Robustness Requirements

- The site should be understandable even if location lookup fails.
- The main answer must be communicated in text, not only through facial expression.
- The site should behave gracefully across modern browsers that support standard client-side web features.
- The site should fail safely and clearly when location cannot be determined.

## Out of Scope

- Any backend service owned or operated for this website
- User accounts
- Persistent storage
- Analytics dashboards
- Social features
- Maps or detailed geographic displays
- Complex interactions beyond answering the central question

## Summary

This website is a minimal static joke site whose sole purpose is to answer the question **“Am I in Thailand?”** using browser-based location methods, with clear results, graceful fallback behavior, and a restrained, simple presentation.
