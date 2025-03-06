# Bulk Copy Announcements

This feature provides the ability for teachers to bulk 'copy' announcements from one course to another course(s) where they are an active Teacher. This 'copy' process is creating new announcements in the selected course(s) so that it will show them as the author of the announcement. Users will need to wait for the 'copy' process to complete before they leave the page to ensure it finishes processing. If there are attached files and/or special embedded LTI content, it will take longer to process as these will need additional steps to copy the content.

Documentation for how our teachers can use this feature can be found at [Copy Announcements into a New Course | Wilmington University](https://www.wilmu.edu/canvas/copycanvascontent.aspx#copyannouncement)

## Notes for Users

- The setting options that are shown will apply to all selected announcements for copies. If you don't want the announcements to post immediately and potentially send notifications, be sure to set a delayed post date/time. v3.0.0 added the ability to set the delayed post date/time for each announcement.
- There are some variables towards the beginning of the code that are used to configure some styles/naming conventions. You can update these as desired, but it isn't required.
- Only courses where you are an active Teacher will show. This is also because the announcements will show the person making the copies as the author of the announcements.
- The special copy process for handling embedded LTI content that uses the new standard, requires permission to create and delete pages so it can get the LTI content associated with the destination course too using a native copy process. A page is temporarily used for this instead of an announcement to avoid a notification potentially being sent.
- The special copy process for handling embedded LTI content may not work for all embedded LTI content, so it is good to review these copied announcements to ensure they copied successfully. This was found to solve the issue for Kaltura video embeds, which is our most common example of embedded LTI content in an announcement.
