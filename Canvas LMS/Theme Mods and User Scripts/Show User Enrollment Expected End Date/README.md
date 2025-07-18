# Show User Enrollment Expected End Date

This feature helps to clarify when a user's enrollment is expected to end. When going to a user's details page within a course, it will show the date that their enrollment concluded if they no longer have access to participate in the course. This feature will check if they have active memberships still and if so, it will determine when the enrollment is expected to conclude by checking for enrollment, section, course, and/or term enrollment dates. After determining the expected date the enrollment will conclude, it shows this under the membership created date.

## Notes for Users

I reviewed the documentation and tested various scenarios to try to determine all the ways that different enrollment dates and overrides work to determine when a user's enrollment will soft-conclude. However, there may be edge cases I didn't fully consider and/or Instructure may adjust the handling of some of the overrides that weren't fully documented without warning. If you submit an Issue for scenarios you come across, we will investigate and try to update the code to handle additional scenarios as needed.

At this time, this feature does not load in the expected end date when looking at your own enrollment in a course due to less data being loaded in by Instructure for Memberships. A workaround may be implemented in a future update to provide this information.
