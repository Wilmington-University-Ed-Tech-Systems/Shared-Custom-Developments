# Respondus Alerts

This feature provides alerts on the course home page about Respondus LockDown Browser. These alerts are intended for admins and teachers to see and use.

Alerts include the following:

- Activate Respondus LockDown Browser
  - This feature uses a Canvas page in the course to track when a user visits the Respondus LockDown Browser in the course.
  - If the tracking page does not exist and/or does not include a log of Respondus for this course, then it will show this alert.
  - The user just needs to visit the Respondus LockDown Browser page in the course for it to log that they went to the page. For the purpose of this feature, it will assume the course has now been activated.
- Settings Not Enabled as Expected
  - It checks for quizzes with "Requires Respondus" in the title of the quiz
  - If the title includes this, but the settings don't have LockDown Browser marked as required it will provide an alert.
  - It will also provide an alert if the title also includes "+ Webcam" and it doesn't have LockDown Browser Monitor marked as required.
  - The alert provides some guidance for recommended settings to review in the LockDown Browser settings.
- Setting Enabled but Not Reflected in Quiz Title

  - This now checks all quizzes in the course.
  - If the quiz title doesn't include "Requires Respondus", then it will check if LockDown Browser or LockDown Browser Monitor are marked as required.
  - It will provide an alert if there are any quizzes where the settings are enabled, but the quiz title doesn't include "Requires Respondus".
  - This error seems to be caused by a user trying to remove Respondus by updating the quiz title rather than using the Respondus LockDown Browser dashboard to update the settings.

  # User Notes

  - Review the configurations and update them as needed.
    - At a minimum the RESPONDUS_TOOL_ID needs to be updated based on your environment. This is currently hard-coded to avoid the need to use an API call to look this up each time.
    - You may also want to adjust the LOG_PAGE_TITLE but it isn't required.
  - The alert messages can be adjusted as desired in the checkRespondus function
  - The styles for the alert can be modified in the createAlert function
