# Extend User Enrollment Course Access

This feature provides a way to use user enrollment specific start and end dates to extend a user's access to a course. This avoids the need to create a separate section to extend access for select users and avoids the issue where extending the course date extends access for everyone. In addition, using this approach allows setting an extension date for the student and a different extension date that is later for the teacher to provide time for them to grade without the student still having access.

When extending a user's access, you will provide the new end date that should be set for the user and it needs to be in the future. Once you click "Update End Date" it will then process updating the user's enrollment to use start and end dates for access. If the course end date has already passed, then the process will temporarily update the course end date to the next day, make the enrollment update to extend access, and then change the course end date back. These additional steps are needed to perform the update with the API, otherwise the update request is rejected due to the course having ended.

## Notes for Users

Currently due to the way that Canvas loads in data on the user page within a course, this does not load for yourself. Thus, someone else would need to extend access for you in the current version. This is on my TODO list to try to implement a workaround for this.

The start date that is used is the enrollment's associated term's start date. If the associated term doesn't have a start date, then it will use the enrollment's creation date as the start date. Since the start date seems like less of a concern when needing to extend access, this should be sufficient. However, I may adjust this in a future release to add a start date input in the future that pre-loads a default value that can be adjusted.

The workaround to temporarily re-open a course that has ended may be updated in the future if Canvas implements a feature request to allow admin with an appropriate permission and/or an additional API parameter to permit enrollment updates in a course that has ended.
