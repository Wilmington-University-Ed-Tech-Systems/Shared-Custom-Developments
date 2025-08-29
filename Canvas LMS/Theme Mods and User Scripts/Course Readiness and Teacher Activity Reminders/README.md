# Course Readiness and Teacher Activity Reminders

This feature will provide alerts to instructors based on the configured settings. Configurations include checks about course readiness and about expected teacher activity. By providing teachers with this visual reminder it can help keep them aware of expectations and makes it easier for them to know if there is something they need to do to meet expectations.

## Configurations to Update

HEADING_FOR_CHECKLIST is the heading that will appear above the checklist that appears on the right-side (as long as the screen is wide enough) of the course home page.

expectations is the array of Expectation objects that are used to evaluate course readiness. This is currently only designed to support one collection of Expectations, but you can configure the startAt and endAt of an Expectation if it should only be active at a certain time in relation to course start and course end. All expectations that are active will be checked and an updated message will be added to the checklist. Alerts will appear at the top of the course home page for unmet expectations with additional details about what is wrong and the necessary action to fix.

### Current Types of Expectations Available

#### SyllabusExpectation

This expectation is used to require the use of the Syllabus "page" in a Canvas course and ensure it is shown in the navigation.

The following settings can be configured for this expectation:

- requirementType
  - Default value: RequirementType.MANDATORY
  - This value will help determine the style of the alert that is shown if it is unmet
  - Recommended values are RequirementType.MANDATORY or RequirementType.WARNING
- minimumWordCount
  - Default value: Expectation.NA
  - This is the minimum number of words that need to be used.
- requiredKeywords
  - Default value: []
  - These are keywords/phrases that are need to be in the Syllabus "page".
  - This check is not case sensitive.
- startAt
  - Default value: Expectation.NA
  - This is the number of days from the course start to start checking.
  - Use 0 for the course start, negative numbers for before course start, positive numbers for after course start, or Expectation.COURSE_END for the course end date.
- endAt
  - Default value: Expectation.NA
  - This is the number of days from the course end to stop checking.
  - Use 0 for the course end, negative numbers for before course end, positive numbers for after course end, or Expectation.COURSE_START for the course start date.

#### SyllabusFileExpectation

This expectation is used to require the use of the Syllabus "page" in a Canvas course, ensure it is shown in the navigation, and expects a Canvas file link (assumed to be the syllabus file).

The following settings can be configured for this expectation:

- requirementType
  - Default value: RequirementType.MANDATORY
  - This value will help determine the style of the alert that is shown if it is unmet
  - Recommended values are RequirementType.MANDATORY or RequirementType.WARNING
- partialFileLinkText
  - Default value: Expectation.NA
  - This value is expected text for the link to the Canvas file.
  - This check is not case sensitive.
- isTeacherRequiredToUploadToCourse
  - Default value: false
  - This wil determine whether or not the linked file needs to be uploaded by the teacher to meet the expectation.
- minimumWordCount
  - Default value: Expectation.NA
  - This is the minimum number of words that need to be used.
  - This only applies directly to the content in the Syllabus "page" not within a linked file.
- requiredKeywords
  - Default value: []
  - These are keywords/phrases that are need to be in the Syllabus "page".
  - This check is not case sensitive.
  - This only applies directly to the content in the Syllabus "page" not within a linked file.
- startAt
  - Default value: Expectation.NA
  - This is the number of days from the course start to start checking.
  - Use 0 for the course start, negative numbers for before course start, positive numbers for after course start, or Expectation.COURSE_END for the course end date.
- endAt
  - Default value: Expectation.NA
  - This is the number of days from the course end to stop checking.
  - Use 0 for the course end, negative numbers for before course end, positive numbers for after course end, or Expectation.COURSE_START for the course start date.

#### PublishedCourseExpectation

This expectation is used to require the course to be published.

The following settings can be configured for this expectation:

- requirementType
  - Default value: RequirementType.MANDATORY
  - This value will help determine the style of the alert that is shown if it is unmet
  - Recommended values are RequirementType.MANDATORY or RequirementType.WARNING
- startAt
  - Default value: Expectation.NA
  - This is the number of days from the course start to start checking.
  - Use 0 for the course start, negative numbers for before course start, positive numbers for after course start, or Expectation.COURSE_END for the course end date.
- endAt
  - Default value: Expectation.NA
  - This is the number of days from the course end to stop checking.
  - Use 0 for the course end, negative numbers for before course end, positive numbers for after course end, or Expectation.COURSE_START for the course start date.

#### CourseDatesExpectation

This expectation is used to define requirements about the course start and end dates.

The following settings can be configured for this expectation:

- requirementType
  - Default value: RequirementType.MANDATORY
  - This value will help determine the style of the alert that is shown if it is unmet
  - Recommended values are RequirementType.MANDATORY or RequirementType.WARNING
- requireStartDate
  - Default value: true
  - This determines if a start date is required to be set for the course.
- requireEndDate
  - Default value: true
  - This determines if an end date is required to be set for the course.
- requireParticipationToBeCourse
  - Default value: false
  - This determines if it is required for participation to be set to Course.
- maxCourseLength
  - Default value: Expectation.NA
  - This is the maximum number of days from course start to course end.
- startAt
  - Default value: Expectation.NA
  - This is the number of days from the course start to start checking.
  - Use 0 for the course start, negative numbers for before course start, positive numbers for after course start, or Expectation.COURSE_END for the course end date.
- endAt
  - Default value: Expectation.NA
  - This is the number of days from the course end to stop checking.
  - Use 0 for the course end, negative numbers for before course end, positive numbers for after course end, or Expectation.COURSE_START for the course start date.

#### AnnouncementsExpectation

This expectation is used to require the use of Announcements.

The following settings can be configured for this expectation:

- requirementType
  - Default value: RequirementType.MANDATORY
  - This value will help determine the style of the alert that is shown if it is unmet
  - Recommended values are RequirementType.MANDATORY or RequirementType.WARNING
- minimumCount
  - Default value: 1
  - This is the minimum number of announcements that are needed to meet the expectation.
- requireToBePosted
  - Default value: true
  - This determines if announcements need to be posted to count.
- requireTeacherAsAuthor
  - Default value: true
  - This determines if the teachers needs to be the author of an announcement for it to count.
- maxDaysSinceLastPost
  - Default value: Expectation.NA
  - This is the maximum number of days that is acceptable since the last announcement was posted.
  - This is useful for setting an expectation likely posting a weekly announcement.
- startAt
  - Default value: Expectation.NA
  - This is the number of days from the course start to start checking.
  - Use 0 for the course start, negative numbers for before course start, positive numbers for after course start, or Expectation.COURSE_END for the course end date.
- endAt
  - Default value: Expectation.NA
  - This is the number of days from the course end to stop checking.
  - Use 0 for the course end, negative numbers for before course end, positive numbers for after course end, or Expectation.COURSE_START for the course start date.

#### AssignmentDueDatesExpectation

This expectation is used to require assignments to have due dates set.

The following settings can be configured for this expectation:

- requirementType
  - Default value: RequirementType.MANDATORY
  - This value will help determine the style of the alert that is shown if it is unmet
  - Recommended values are RequirementType.MANDATORY or RequirementType.WARNING
- requireForZeroPointAssignments
  - Default value: false
  - This determines if assignments that are zero points are required to have due dates.
- requireForAssignmentsNotAffectingFinalGrade
  - Default value: false
  - This determines if assignments are required to have due dates if they are set to not affect the final grade, are set to not graded, and/or are in a weighted assignment group that is 0%.
- requireDueDateAfterCourseStartDate
  - Default value: true
  - This determines if the due date has to be after the course start date.
- requireDueDateBeforeCourseEndDate
  - Default value: true
  - This determines if the due date has to be before the course end date.
- startAt
  - Default value: Expectation.NA
  - This is the number of days from the course start to start checking.
  - Use 0 for the course start, negative numbers for before course start, positive numbers for after course start, or Expectation.COURSE_END for the course end date.
- endAt
  - Default value: Expectation.NA
  - This is the number of days from the course end to stop checking.
  - Use 0 for the course end, negative numbers for before course end, positive numbers for after course end, or Expectation.COURSE_START for the course start date.

#### TimelyGradingExpectation

This expectation is used to check that assignment submissions are graded within a certain number of days.

The following settings can be configured for this expectation:

- requirementType
  - Default value: RequirementType.MANDATORY
  - This value will help determine the style of the alert that is shown if it is unmet
  - Recommended values are RequirementType.MANDATORY or RequirementType.WARNING
- maxDaysUngraded
  - Default value: 7
  - This will determine the maximum number of days a submission can be left ungraded.
  - If the assignment has a due date, it will be the number of days from the due date for submissions that are submitted on time.
  - If the assignment doesn't have a due date or the submission is late, it will be the number of days from the submission date.
- requireForZeroPointAssignments
  - Default value: false
  - This determines if the grading expectation applies to assignments that are 0 points.
- requireForAssignmentsNotAffectingFinalGrade
  - Default value: false
  - This determines if the grading expectation applies to assignments that are set to not affect the final grade, are set to not graded, and/or are in a weighted assignment group worth 0%.
- startAt
  - Default value: Expectation.NA
  - This is the number of days from the course start to start checking.
  - Use 0 for the course start, negative numbers for before course start, positive numbers for after course start, or Expectation.COURSE_END for the course end date.
- endAt
  - Default value: Expectation.NA
  - This is the number of days from the course end to stop checking.
  - Use 0 for the course end, negative numbers for before course end, positive numbers for after course end, or Expectation.COURSE_START for the course start date.

### Defining an Expectation

expectations is currently pre-configured with some starter examples. Feel free to add, remove, and/or change the existing expectations. You may want to comment it out if you want to keep an example for reference.

The simplest way to create an Expectation object is to use the default constructor. This will create an Expectation that uses all the default values. Example:

```
new SyllabusExpectation()
```

The code above creates an SyllabusExpectation object that is mandatory. This will require the Syllabus to be available to students and have something on it, but no specific requirements for minimum word count nor required words/phrases. It also doesn't have a startAt nor endAt so it will always be an active expectation to check.

To customize the settings for an Expectation, you will use the constructor and provide an object with the key-value pairs that you want to configure. You only need to include key-value pairs for settings that you want to be different than the default value. Example:

```
new AnnouncementExpectation({
  startAt: 0,
  maxDaysSinceLastPost: 7,
})
```

The code above creates an AnnouncementExpectation object that is customized to start at the course start date (0 days from course start) and requires an announcement to be posted within the last 7 days. In this case it still uses the default settings to make it mandatory that there is at least one announcement that is posted (not delayed) and the teacher needs to show as the author of the announcement (not unknown due to a copied announcement). In addition, this will always be an active expectation after the course start date since endAt wasn't changed.

Please be aware that there are some special values that should be used.

- Expectation.NA should be used for settings of an Expectation that don't apply
- requirementType should be set using one of the RequirementType values (i.e. RequirementType.MANDATORY, RequirementType.WARNING)
- When you want an Expectation to endAt the course start use Expectation.COURSE_START
- When you want an Expectation to startAt the course end use Expectation.COURSE_END

Here is an example of creating an Expectation object that uses some of these special values when customizing the settings.

```
new AnnouncementExpectation({
  requirementType: RequirementType.WARNING,
  endAt: Expectation.COURSE_START,
})
```

The code above creates an AnnouncementExpectation that is customized to only be a warning (rather than the default mandatory) and ends when the course starts. The other default settings make it so that it requires at least one announcement that is posted (not delayed) and the teacher needs to show as the author of the announcement (not unknown due to a copied announcement). Since startAt isn't set, it will be active before the course starts.

## Important Things to Note

This is an initial set of expectations that are similar to the checks we currently utilize. I plan to update this in the future to add more types of Expectations and/or additional requirements that could be checked.

If you wish to change the messages that appear, you will need to update the code for the classes. Please note, that you will need to handle these changes in the future too when new versions of this are released.

If you need to use start/end dates other than the Canvas Student Participation dates of the course/term, then currently you will need to update the code to handle this. I recommend using a new function for this to make your changes easier to identify when new versions of this are released.

This currently is only a course level feature. However, you could use this code as a basis to build an account level report.
