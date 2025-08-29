// ==UserScript==
// @name         Course Readiness and Teacher Activity Reminders
// @namespace    https://github.com/Wilmington-University-Ed-Tech-Systems/Shared-Custom-Developments/tree/main/Canvas%20LMS/Course%20Readiness%20and%20Teacher%20Activity%20Reminders
// @version      1.0.0
// @description  Adds reminders on the course home page for things a teacher needs to do to meet course readiness and teacher activity expectations
// @author       James Sekcienski, Ed Tech Systems, Wilmington University
// @match      https://*.instructure.com/courses/*
// ==/UserScript==

"use strict";

(async () => {
  const cache = new Map();

  const AlertType = Object.freeze({
    WARNING: "WARNING",
    ERROR: "ERROR",
    INFORMATIONAL: "INFO",
  });

  const RequirementType = Object.freeze({
    MANDATORY: AlertType.ERROR, // Mandatory requirements will show as an error alert when it isn't met
    OPTIONAL: AlertType.WARNING, // Optional requirements will show as a warning alert when it isn't met
    INFORMATIONAL: AlertType.INFORMATIONAL, // This is used for informational alerts that should only appear at certain times
  });

  // Expectation Configs
  const HEADING_FOR_CHECKLIST = "Teaching Expectations";

  class Expectation {
    static NA = "N/A"; // Use this for settings that don't apply and/or aren't set yet
    static COURSE_START = "course_start"; // Use as a special end at value
    static COURSE_END = "course_end"; // Use as a special start at value

    constructor({
      requirementType = RequirementType.INFORMATIONAL,
      startAt = Expectation.NA,
      endAt = Expectation.NA,
    } = {}) {
      this.type = requirementType; // The RequirementType for this expectation.
      this.startAt = startAt; // Days from course start date to begin checking for requirement. Use negative values for before course start date. Use NA to assume start checking now. Use COURSE_END to start from course end date.
      this.endAt = endAt; // Days from course end date to stop checking for requirement. Use negative values for before course end date. Use NA to assume it should not stop checking. Use COURSE_START to stop at course start date.

      // Default values before expectation is checked
      this.isMet = Expectation.NA;
      this.shortMessage = Expectation.NA;
      this.longMessage = Expectation.NA;
      this.messageType = requirementType;
    }

    getName() {
      return "Generic Expectation";
    }

    // Determines if this expectation should be checked based on the startAt and endAt settings and the course dates
    isActiveExpectation(courseStartDate, courseEndDate) {
      const currentDate = new Date();

      // TODO: Improve handling of special values for startAt and endAt values

      if (this.startAt == Expectation.COURSE_END && courseEndDate) {
        if (currentDate < courseEndDate) {
          return false;
        }
      } else if (
        this.startAt != Expectation.NA &&
        this.startAt != Expectation.COURSE_END &&
        courseStartDate
      ) {
        if (this.startAt >= convertMsToDays(currentDate - courseStartDate)) {
          return false;
        }
      }

      if (this.endAt == Expectation.COURSE_START && courseStartDate) {
        if (currentDate >= courseStartDate) {
          return false;
        }
      } else if (
        this.endAt != Expectation.NA &&
        this.endAt != Expectation.COURSE_START &&
        courseEndDate
      ) {
        if (this.endAt < convertMsToDays(currentDate - courseEndDate)) {
          return false;
        }
      }

      return true;
    }

    async checkExpectation(courseId) {
      this.isMet = false;
      this.shortMessage = "Undefined Expectation";
      this.longMessage =
        "This expectation is not defined so no check can be performed.";
      this.messageType = AlertType.ERROR;
    }

    static convertHTMLToText(htmlContent) {
      const tempDomParser = new DOMParser();
      const parsedHTML = tempDomParser.parseFromString(
        htmlContent,
        "text/html"
      );
      return parsedHTML?.body?.innerText ?? "";
    }

    static checkWordCountRequirement(
      minimumWordCount,
      content,
      isContentHTML = true
    ) {
      if (minimumWordCount == Expectation.NA || minimumWordCount <= 0) {
        return {
          isMet: true,
          details: "Not required",
        };
      }

      if (isContentHTML) {
        content = Expectation.convertHTMLToText(content);
      }

      content = content.replaceAll("\n", " "); // replace line breaks with space
      content = content.replaceAll("-", ""); // remove hyphens
      content = content.replaceAll("  ", " "); // replace duplicate spaces
      content = content.trim();

      const words = content.split(" "); // TODO: Determine if additional data cleaning may be needed
      if (words.length >= minimumWordCount) {
        return {
          isMet: true,
          details: "Met minimum word count requirement",
        };
      } else {
        return {
          isMet: false,
          details: `The minimum word count requirement (${minimumWordCount} words) has not been met. Current word count is ${words.length}.`,
        };
      }
    }

    static checkRequiredKeywords(
      requiredKeywords,
      content,
      isContentHTML = true
    ) {
      if (requiredKeywords == Expectation.NA || requiredKeywords.length == 0) {
        return {
          isMet: true,
          details: "Not required",
        };
      }

      if (isContentHTML) {
        content = Expectation.convertHTMLToText(content);
      }

      const formattedContent = content.toLowerCase();
      for (const keyword of requiredKeywords) {
        if (!formattedContent.includes(keyword.toLowerCase())) {
          return {
            isMet: false,
            details: `The following required keyword/phrase was not found: '${keyword}'`,
          };
        }
      }

      return {
        isMet: true,
        details: "All required keywords/phrases found",
      };
    }
  }

  class SyllabusExpectation extends Expectation {
    constructor({
      requirementType = RequirementType.MANDATORY,
      minimumWordCount = Expectation.NA,
      requiredKeywords = [],
      startAt = Expectation.NA,
      endAt = Expectation.NA,
    } = {}) {
      super({ requirementType, startAt, endAt });
      this.minimumWordCount = minimumWordCount; // Minimum number of words on the Syllabus page. Use NA to not check something is set for the Syllabus.
      this.requiredKeywords = requiredKeywords; // A set of keywords/phrases that need to be in the Syllabus. Check is case insensitive. Leave empty if there aren't any required keywords/phrases to check for
    }

    getName() {
      return "Syllabus";
    }

    async checkExpectation(courseId) {
      // Ensure tab is visible
      const tabs = await getTabs(courseId);
      const nativeSyllabusTab = tabs.find((tab) => tab.id == "syllabus");
      if (!nativeSyllabusTab || nativeSyllabusTab?.hidden) {
        this.isMet = false;
        this.shortMessage = "Syllabus is hidden";
        this.longMessage = `
          <div>
            <p>The Syllabus page is currently hidden from students. Go to course <a href='/courses/${courseId}/settings#tab-navigation'>settings</a> to enable the Syllabus under the Navigation tab.</p>
          </div>
        `;
        return;
      }

      // Ensure there is content on the Syllabus
      const courseDetails = await getCourseDetails(courseId);
      const syllabus = courseDetails?.syllabus_body ?? "";
      if (!syllabus) {
        this.isMet = false;
        this.shortMessage = "Missing syllabus";
        this.longMessage = `
          <div>
            <p>The Syllabus page currently doesn't have any content. Update the <a href='/courses/${courseId}/assignments/syllabus'>Syllabus</a> to provide necessary information about the course to students.
          </div>
        `;
        return;
      }

      const wordCountCheck = Expectation.checkWordCountRequirement(
        this.minimumWordCount,
        syllabus,
        true
      );
      if (!wordCountCheck?.isMet) {
        this.isMet = false;
        (this.shortMessage = "Syllabus word count not met"),
          (this.longMessage = `
          <div>
            <p>The <a href='/courses/${courseId}/assignments/syllabus'>Syllabus</a> minimum word count requirement has not been met.</p>
            <p>${wordCountCheck?.details}</p>
          </div>
        `);
        return;
      }

      const requiredKeywordsCheck = Expectation.checkRequiredKeywords(
        this.requiredKeywords,
        syllabus,
        true
      );
      if (!requiredKeywordsCheck?.isMet) {
        this.isMet = false;
        this.shortMessage = "Syllabus missing required text";
        this.longMessage = `
          <div>
            <p>The <a href='/courses/${courseId}/assignments/syllabus'>Syllabus</a> is missing a required keyword/phrase.</p>
            <p>${requiredKeywordsCheck?.details}</p>
          </div>
        `;
        return;
      }

      // Passed requirement checks
      this.isMet = true;
      this.shortMessage = "Syllabus meets expectation";
    }
  }

  class SyllabusFileExpectation extends SyllabusExpectation {
    // Use this class when checking for a linked Canvas file on the Syllabus page.
    // Keep in mind required keywords will only check content directly on the page not in the file
    constructor({
      requirementType = RequirementType.MANDATORY,
      partialFileLinkText = Expectation.NA,
      isTeacherRequiredToUploadToCourse = false,
      minimumWordCount = Expectation.NA,
      requiredKeywords = [],
      startAt = Expectation.NA,
      endAt = Expectation.NA,
    } = {}) {
      super({
        requirementType,
        minimumWordCount,
        requiredKeywords,
        startAt,
        endAt,
      });
      this.partialFileLinkText = partialFileLinkText; // The partial file like text that is required (i.e. 'syllabus'). Check is case insensitive. Use NA if the file name doesn't matter.
      this.isTeacherRequiredToUploadToCourse =
        isTeacherRequiredToUploadToCourse; // Whether or not a teacher of the course must upload the file to the course to meet the requirement.
    }

    getName() {
      return "Syllabus with File";
    }

    async checkExpectation(courseId) {
      const courseDetails = await getCourseDetails(courseId);
      const syllabus = courseDetails?.syllabus_body ?? "";
      const tempDOM = new DOMParser().parseFromString(syllabus, "text/html");

      // Get all links to a Canvas File
      let fileLinks = [
        ...tempDOM.querySelectorAll('a[data-api-returntype="File"]'),
      ];
      if (fileLinks.length == 0) {
        this.isMet = false;
        this.shortMessage = "Missing syllabus file";
        this.longMessage = `
          <div>
            <p>No Canvas file links found on <a href='/courses/${courseId}/assignments/syllabus'>Syllabus</a> page.</p>
          </div>
        `;
        return;
      }

      if (this.partialFileLinkText != Expectation.NA) {
        // Filter the links to those with the required partial link text
        fileLinks = fileLinks.filter((link) =>
          link.innerText
            .toLowerCase()
            .includes(this.partialFileLinkText.toLowerCase())
        );
        if (fileLinks.length == 0) {
          this.isMet = false;
          this.shortMessage = "Missing syllabus file";
          this.longMessage = `
            <div>
              <p>No Canvas file links found on <a href='/courses/${courseId}/assignments/syllabus'>Syllabus</a> page with the required link text.</p>
              <p>File link text must include the following: ${this.partialFileLinkText}</p>
            </div>
          `;
          return;
        }
      }

      if (this.isTeacherRequiredToUploadToCourse === true) {
        const fileIds = this.getFileIds(fileLinks);

        if (fileIds.length == 0) {
          this.isMet = false;
          this.shortMessage = "Syllabus file missing";
          this.longMessage = `
            <div>
              <p>No Canvas file links with ids found on <a href='/courses/${courseId}/assignments/syllabus'>Syllabus</a> page.</p>
            </div>
          `;
          return;
        }

        let isTeacherUploadFound = await this.hasTeacherUploadedFile(
          courseDetails,
          fileIds
        );

        if (!isTeacherUploadFound) {
          this.isMet = false;
          this.shortMessage = "Syllabus file missing";
          this.longMessage = `
            <div>
              <p>No Canvas file found on <a href='/courses/${courseId}/assignments/syllabus'>Syllabus</a> page that was uploaded by a teacher of this course.</p>
            </div>
          `;
          return;
        }
      }

      // File requirements passed. Check that other Syllabus requirements are met.
      await super.checkExpectation(courseId);
    }

    getFileIds(fileLinks) {
      const fileIds = [];
      for (let fileLink of fileLinks) {
        const url = fileLink.href;
        let temp = url.split("/files/");
        if (temp.length > 1) {
          temp = temp[1];
          temp = temp.split("/")[0];
          temp = temp.split("?")[0];
          fileIds.push(temp);
        }
      }
      return fileIds;
    }

    async hasTeacherUploadedFile(courseDetails, fileIds) {
      const courseId = courseDetails?.id;
      const teachers = courseDetails?.teachers ?? [];
      const courseCreationDate = new Date(courseDetails.created_at);

      for (let fileId of fileIds) {
        const fileRequest = await getFile(courseId, fileId);
        const fileDetails = fileRequest.results;
        const userIdOfFileCreator = fileDetails?.user?.id;

        // Checking that the file was uploaded by a user after the course was created
        if (
          userIdOfFileCreator &&
          new Date(fileDetails["created_at"]) > courseCreationDate
        ) {
          // Checking if the file was uploaded by a teacher of the course
          if (
            teachers.some((teacher) => {
              return teacher.id == userIdOfFileCreator;
            })
          ) {
            return true;
          }
        }
      }

      return false;
    }
  }

  class PublishedCourseExpectation extends Expectation {
    constructor({
      requirementType = RequirementType.MANDATORY,
      startAt = Expectation.NA,
      endAt = Expectation.NA,
    } = {}) {
      super({
        requirementType,
        startAt,
        endAt,
      });
    }

    getName() {
      return "Published Course";
    }

    async checkExpectation(courseId) {
      const courseDetails = await getCourseDetails(courseId);

      if (courseDetails?.workflow_state == "unpublished") {
        this.isMet = false;
        this.shortMessage = "Course is unpublished";
        this.longMessage = `
          <div>
            <p>This course is currently unpublished. The course needs to be published before students potentially have access.</p>
          </div>
        `;
        return;
      }

      // Passed requirements
      this.isMet = true;
      this.shortMessage = "Course is published";
    }
  }

  class CourseDatesExpectation extends Expectation {
    constructor({
      requirementType = RequirementType.MANDATORY,
      requireStartDate = true,
      requireEndDate = true,
      requireParticipationToBeCourse = false,
      maxCourseLength = Expectation.NA,
      startAt = Expectation.NA,
      endAt = Expectation.NA,
    } = {}) {
      super({
        requirementType,
        startAt,
        endAt,
      });
      this.requireStartDate = requireStartDate;
      this.requireEndDate = requireEndDate;
      this.requireParticipationToBeCourse = requireParticipationToBeCourse; // Use true if course participation must be set to Course. Use false if Term or Course participation dates may be used.
      this.maxCourseLength = maxCourseLength; // Number of days
    }

    getName() {
      return "Course Dates";
    }

    async checkExpectation(courseId) {
      const courseDetails = await getCourseDetails(courseId);

      if (
        this.requireParticipationToBeCourse &&
        !courseDetails?.restrict_enrollments_to_course_dates
      ) {
        this.isMet = false;
        this.shortMessage = "Incorrect course participation";
        this.longMessage = `
          <div>
            <p>The course participation is not currently set to Course.</p>
            <p>Go to the course <a href='/courses/${courseId}/settings'>settings</a> to update the course participation.</p>
          </div>
        `;
        return;
      }

      const [startDate, endDate] = await getCourseStudentParticipationDates(
        courseId
      );
      if (this.requireStartDate && !startDate) {
        this.isMet = false;
        this.shortMessage = "Missing start date";
        this.longMessage = `
          <div>
            <p>The course is missing a required course start date.</p>
            <p>Go to the course <a href='/courses/${courseId}/settings'>settings</a> to update the course start date.</p>
          </div>
        `;
        return;
      }

      if (this.requireEndDate && !endDate) {
        this.isMet = false;
        this.shortMessage = "Missing end date";
        this.longMessage = `
          <div>
            <p>The course is missing a required course end date.</p>
            <p>Go to the course <a href='/courses/${courseId}/settings'>settings</a> to update the course end date.</p>
          </div>
        `;
        return;
      }

      if (
        this.maxCourseLength != Expectation.NA &&
        this.maxCourseLength > 0 &&
        (!startDate ||
          !endDate ||
          this.maxCourseLength < convertMsToDays(endDate - startDate))
      ) {
        this.isMet = false;
        this.shortMessage = "Course length too long";
        this.longMessage = `
          <div>
            <p>This course has extended the maximum course length of ${this.maxCourseLength} days.</p>
            <p>Go to the course <a href='/courses/${courseId}/settings'>settings</a> to update the course dates.</p>
          </div>
        `;
        return;
      }

      // Passed checks
      this.isMet = true;
      this.shortMessage = "Course dates meet expectation";
    }
  }

  class AnnouncementExpectation extends Expectation {
    constructor({
      requirementType = RequirementType.MANDATORY,
      minimumCount = 1,
      requireToBePosted = true,
      requireTeacherAsAuthor = true,
      maxDaysSinceLastPost = Expectation.NA,
      startAt = Expectation.NA,
      endAt = Expectation.NA,
    } = {}) {
      super({
        requirementType,
        startAt,
        endAt,
      });
      if (minimumCount == Expectation.NA || minimumCount < 1) {
        minimumCount = 1;
      }
      this.minimumCount = minimumCount; // The minimum number of announcements
      this.requireToBePosted = requireToBePosted; // If true, this won't count announcements that are scheduled, but not yet posted. If false, it will include posted and scheduled announcements.
      this.requireTeacherAsAuthor = requireTeacherAsAuthor; // If true, this won't count announcements that don't have a teacher in the course as the author. If false, it won't check the author of the announcements.
      this.maxDaysSinceLastPost = maxDaysSinceLastPost; // The maximum number of days since an announcement was posted. Use Expectation.NA if there isn't a requirement.
    }

    getName() {
      return "Announcement";
    }

    async checkExpectation(courseId) {
      let announcements = await getCourseAnnouncements(courseId);
      if (this.requireToBePosted) {
        // Filter out announcements that are still delayed
        announcements = this.removeDelayedAnnouncements(announcements);
      }

      if (this.requireTeacherAsAuthor) {
        // Filter out announcements not posted by teacher of the course
        const courseDetails = await getCourseDetails(courseId);
        const teachers = courseDetails?.teachers;
        if (teachers.length == 0) {
          this.isMet = false;
          this.shortMessage = "No teachers enrolled";
          this.longMessage = `
            <div>
              <p>No teachers enrolled in course.</p>
              <p>Unable to meet expectation of an announcement posted by a teacher.</p>
            </div>
          `;
          return;
        }

        announcements = this.removeAnnouncementsNotByTeacher(
          announcements,
          teachers
        );
      }

      if (announcements.length < this.minimumCount) {
        this.isMet = false;
        this.shortMessage = "Missing announcement";
        this.longMessage = `
          <div>
            <p>Didn't meet the announcement expectation.</p>
            <p>There should be at least ${this.minimumCount}${
          this.requireToBePosted ? " posted" : ""
        } <a href='/courses/${courseId}/announcements'>announcement(s)</a>${
          this.requireTeacherAsAuthor ? " with a teacher as the author" : ""
        }.</p>
          </div>
        `;
        return;
      }

      if (
        this.maxDaysSinceLastPost != Expectation.NA &&
        this.maxDaysSinceLastPost >= 1
      ) {
        // Filter announcements posted older than max days
        announcements = await this.removeOldAnnouncements(
          courseId,
          announcements
        );

        if (announcements.length == 0) {
          this.isMet = false;
          this.shortMessage = "Need new announcement";
          this.longMessage = `
            <div>
              <p>Need to post a new <a href='/courses/${courseId}/announcements'>announcement</a>.</p>
              <p>Announcements need to be posted during the course at least once every ${this.maxDaysSinceLastPost} days to meet this expectation.</p>
            </div>
          `;
          return;
        }
      }

      // Passed requirement checks
      this.isMet = true;
      this.shortMessage = "Announcements meet expectation";
    }

    removeDelayedAnnouncements(announcements) {
      return announcements.filter((announcement) => {
        const currentDateTime = new Date();

        const postedAt = announcement?.posted_at;
        if (!postedAt) {
          return false;
        }

        const delayedPostAt = announcement?.delayed_post_at;
        if (!delayedPostAt) {
          return true;
        }

        const delayedPostAtDateTime = new Date(delayedPostAt);
        return delayedPostAtDateTime <= currentDateTime;
      });
    }

    removeAnnouncementsNotByTeacher(announcements, teachers) {
      return announcements.filter((announcement) => {
        const author = announcement?.author;
        if (!author) {
          return false;
        }

        return teachers.some((teacher) => {
          return teacher?.id == author?.id;
        });
      });
    }

    async removeOldAnnouncements(courseId, announcements) {
      // Determine days since course end date
      // This will be used to adjust oldestDateTimeAllowed so that if this check
      // continues to run after course end, it won't continue to expect new announcements
      // after the course end.
      const currentDateTime = new Date();
      const [startDate, endDate] = await getCourseStudentParticipationDates(
        courseId
      );
      let daysSinceCourseEndDate = 0;
      const hasCourseEnded = endDate && endDate <= currentDateTime;
      if (hasCourseEnded) {
        daysSinceCourseEndDate = convertMsToDays(currentDateTime - endDate);
      }

      return announcements.filter((announcement) => {
        const currentDateTime = new Date();
        const oldestDateTimeAllowed = new Date();
        oldestDateTimeAllowed.setDate(
          oldestDateTimeAllowed.getDate() -
            this.maxDaysSinceLastPost -
            daysSinceCourseEndDate
        );

        const postedAt = announcement?.posted_at;
        if (!postedAt) {
          return false;
        }

        const delayedPostAt = announcement?.delayed_post_at;
        if (!delayedPostAt) {
          const postedAtDateTime = new Date(postedAt);
          return postedAtDateTime >= oldestDateTimeAllowed;
        }

        const delayedPostAtDateTime = new Date(delayedPostAt);
        return (
          delayedPostAtDateTime <= currentDateTime &&
          delayedPostAtDateTime >= oldestDateTimeAllowed
        );
      });
    }
  }

  class AssignmentDueDatesExpectation extends Expectation {
    constructor({
      requirementType = RequirementType.MANDATORY,
      requireForZeroPointAssignments = false,
      requireForAssignmentsNotAffectingFinalGrade = false,
      requireDueDateAfterCourseStartDate = true,
      requireDueDateBeforeCourseEndDate = true,
      startAt = Expectation.NA,
      endAt = Expectation.NA,
    } = {}) {
      super({
        requirementType,
        startAt,
        endAt,
      });
      this.requireForZeroPointAssignments = requireForZeroPointAssignments; // If false, assignments that are 0 points won't require a due date set
      this.requireForAssignmentsNotAffectingFinalGrade =
        requireForAssignmentsNotAffectingFinalGrade; // If false, assignments that are set to not affect the final grade, have a grading type of not graded, and/or are in a 0% assignment weight group won't require a due date set
      this.requireDueDateAfterCourseStartDate =
        requireDueDateAfterCourseStartDate;
      this.requireDueDateBeforeCourseEndDate =
        requireDueDateBeforeCourseEndDate;
    }

    getName() {
      return "Due Dates";
    }

    async checkExpectation(courseId) {
      let assignments = await this.getAssignments(courseId);

      if (assignments.length == 0) {
        this.isMet = false;
        this.shortMessage = "Missing assignment(s)";
        this.longMessage = `
          <div>
            <p>No <a href='/courses/${courseId}/assignments'>assignments</a> were found.</p>
            <p>Unable to check due date expectation since there are no assignments.</p>
          </div>
        `;
        return;
      }

      if (!this.requireForAssignmentsNotAffectingFinalGrade) {
        assignments = assignments.filter((assignment) => {
          return (
            !assignment["omit_from_final_grade"] &&
            assignment["grading_type"] != "not_graded"
          );
        });
      }

      if (!this.requireForZeroPointAssignments) {
        assignments = assignments.filter((assignment) => {
          return (assignment?.points_possible ?? 0) > 0;
        });
      }

      const assignmentsWithDueDates = assignments.filter((assignment) => {
        const allDueDates = assignment["all_dates"];
        return allDueDates.every((dueDate) => {
          return !!dueDate?.due_at;
        });
      });

      const assignmentsMissingDueDates = assignments.filter((assignment) => {
        const allDueDates = assignment["all_dates"];
        return !allDueDates.every((dueDate) => {
          return !!dueDate?.due_at;
        });
      });

      if (assignmentsWithDueDates.length == 0) {
        this.isMet = false;
        this.shortMessage = "No due dates set";
        this.longMessage = `
          <div>
            <p>No due dates have been set on assignments.</p>
            <p>Go to <a href='/courses/${courseId}/assignments">assignments</a> to set due dates</p>
          </div>
        `;
        return;
      }

      if (
        this.requireDueDateAfterCourseStartDate ||
        this.requireDueDateBeforeCourseEndDate
      ) {
        const assignmentsWithInvalidDueDates =
          await this.removeAssignmentsWithValidDueDates(
            courseId,
            assignmentsWithDueDates
          );

        if (assignmentsWithInvalidDueDates.length > 0) {
          this.isMet = false;
          this.shortMessage = "Invalid due dates";
          this.longMessage = `
            <div>
              <p>Assignments were found with invalid due dates.</p>
              <p>Go to <a href='/courses/${courseId}/assignments'>assignments</a> to make sure all due dates are ${
            this.requireDueDateBeforeCourseEndDate &&
            this.requireDueDateAfterCourseStartDate
              ? "within course dates"
              : this.requireDueDateAfterCourseStartDate
              ? "after the course start date"
              : "before the course end date"
          }.</p>
              <details>
                <summary>Assignments with Invalid Due Dates</summary>
                <div>
                  ${this.createListOfAssignmentsAsHTML(
                    courseId,
                    assignmentsWithInvalidDueDates
                  )}
                </div>
              </details>
            </div>
          `;
          return;
        }
      }

      const numOfAssignments = assignments.length;
      const numOfAssignmentsWithDueDates = assignmentsWithDueDates.length;

      if (numOfAssignments > numOfAssignmentsWithDueDates) {
        const percentageComplete = Math.floor(
          (numOfAssignmentsWithDueDates * 100) / numOfAssignments
        );
        this.isMet = false;
        this.shortMessage = `${percentageComplete}% of due dates set`;
        this.longMessage = `
          <div>
            <p>There are assignments missing a due date.</p>
            <p>Go to <a href='/courses/${courseId}/assignments'>assignments</a> to update assignment(s) missing due dates.</p>
            <details>
              <summary>Assignments Missing Due Dates</summary>
              <div>
                ${this.createListOfAssignmentsAsHTML(
                  courseId,
                  assignmentsMissingDueDates
                )}
              </div>
            </details>
          </div>
        `;
        return;
      }

      // Passed all checks
      this.isMet = true;
      this.shortMessage = "Due dates meet expectation";
    }

    async getAssignments(courseId) {
      const courseDetails = await getCourseDetails(courseId);
      const usesWeightGroups =
        courseDetails?.apply_assignment_group_weights || false;
      let assignmentWeightGroupsWithAssignments =
        await getAssignmentGroupsWithAssignments(courseId);
      if (
        !this.requireForAssignmentsNotAffectingFinalGrade &&
        usesWeightGroups
      ) {
        assignmentWeightGroupsWithAssignments =
          assignmentWeightGroupsWithAssignments.filter((group) => {
            return (group?.group_weight ?? 0) > 0;
          });
      }

      return assignmentWeightGroupsWithAssignments.reduce(
        (assignmentsFromGroups, group) => {
          assignmentsFromGroups.push(...(group?.assignments ?? []));
          return assignmentsFromGroups;
        },
        []
      );
    }

    async removeAssignmentsWithValidDueDates(courseId, assignments) {
      const [startDate, endDate] = await getCourseStudentParticipationDates(
        courseId
      );
      return assignments.filter((assignment) => {
        const allDueDates = assignment["all_dates"];

        for (const dueDate of allDueDates) {
          if (!dueDate["due_at"]) {
            return true;
          } else if (
            this.requireDueDateAfterCourseStartDate &&
            startDate instanceof Date &&
            new Date(dueDate["due_at"]) < startDate
          ) {
            return true;
          } else if (
            this.requireDueDateBeforeCourseEndDate &&
            endDate instanceof Date &&
            new Date(dueDate["due_at"]) > endDate
          ) {
            return true;
          }
        }
        return false;
      });
    }

    createListOfAssignmentsAsHTML(courseId, assignments) {
      const listItems = assignments.map((assignment) => {
        return `
          <li>
            <a target='_blank' href='/courses/${courseId}/assignments/${assignment?.id}'>${assignment?.name}</a>
          </li>
        `;
      });

      return `
        <ul>
          ${listItems.join("")}
        </ul>
      `;
    }
  }

  class TimelyGradingExpectation extends Expectation {
    constructor({
      requirementType = RequirementType.MANDATORY,
      maxDaysUngraded = 7,
      requireForZeroPointAssignments = false,
      requireForAssignmentsNotAffectingFinalGrade = false,
      startAt = Expectation.NA,
      endAt = Expectation.NA,
    } = {}) {
      super({
        requirementType,
        startAt,
        endAt,
      });
      this.maxDaysUngraded = maxDaysUngraded; // This is the maximum number of days an assignment should be left ungraded before a warning. If a due date is set on the assignment, this will count from the due date rather than the submission date if the submission date is before the due date.  Late submissions and/or submissions on assignments without a due date will calculate from the submission date.
      this.requireForZeroPointAssignments = requireForZeroPointAssignments;
      this.requireForAssignmentsNotAffectingFinalGrade =
        requireForAssignmentsNotAffectingFinalGrade; // If false, assignments that are set to not affect the final grade, have a grading type of not graded, and/or are in a 0% assignment weight group won't require a due date set
    }

    getName() {
      return "Timely Grading";
    }

    async checkExpectation(courseId) {
      let assignments = await this.getAssignments(courseId);

      if (assignments.length == 0) {
        this.isMet = false;
        this.shortMessage = "Missing assignment(s)";
        this.longMessage = `
          <div>
            <p>No <a href='/courses/${courseId}/assignments'>assignments</a> were found.</p>
            <p>Unable to check timely grading expectation since there are no assignments.</p>
          </div>
        `;
        return;
      }

      if (!this.requireForAssignmentsNotAffectingFinalGrade) {
        assignments = assignments.filter((assignment) => {
          return (
            !assignment["omit_from_final_grade"] &&
            assignment["grading_type"] != "not_graded"
          );
        });
      }

      if (!this.requireForZeroPointAssignments) {
        assignments = assignments.filter((assignment) => {
          return (assignment?.points_possible ?? 0) > 0;
        });
      }

      if (assignments.length == 0) {
        this.isMet = false;
        this.shortMessage = "Missing assignments";
        this.longMessage = `
          <div>
            <p>No <a href='/courses/${courseId}/assignments'>assignments</a> were found meeting expectations.</p>
            <p>Unable to check timely grading expectation since there are no assignments meeting expectations.</p>
          </div>
        `;
        return;
      }

      const submittedSubmissions = await getSubmissions(courseId, "submitted");
      const overdueSubmittedSubmissions = this.filterSubmissions(
        submittedSubmissions,
        assignments
      );

      if (overdueSubmittedSubmissions.length > 0) {
        this.isMet = false;
        this.shortMessage = "Overdue grading";
        this.longMessage = `
          <div>
            <p>Found submissions overdue for grading</p>
            <p>Submssions should be graded with ${this.maxDaysUngraded} days</p>
            <details>
              <summary>Assignments with Submissions Overdue for Grading</summary>
              <div>
                ${this.createListOfAssignmentsWithOverdueGradingAsHTML(
                  courseId,
                  assignments,
                  overdueSubmittedSubmissions
                )}
              </div>
            </details>
          </div>
        `;
        return;
      }

      let pendingReviewSubmissions = await getSubmissions(
        courseId,
        "pending_review"
      );
      const overduePendingReviewSubmissions = this.filterSubmissions(
        pendingReviewSubmissions,
        assignments
      );

      if (overduePendingReviewSubmissions.length > 0) {
        this.isMet = false;
        this.shortMessage = "Overdue grading";
        this.longMessage = `
          <div>
            <p>Found submissions overdue for grading</p>
            <p>Submssions should be graded with ${this.maxDaysUngraded} days</p>
            <details>
              <summary>Assignments with Submissions Overdue for Grading</summary>
              <div>
                ${this.createListOfAssignmentsWithOverdueGradingAsHTML(
                  courseId,
                  assignments,
                  overduePendingReviewSubmissions
                )}
              </div>
            </details>
          </div>
        `;
        return;
      }

      // Passed checkes
      this.isMet = true;
      this.shortMessage = "Grading meets expectations";
    }

    async getAssignments(courseId) {
      const courseDetails = await getCourseDetails(courseId);
      const usesWeightGroups =
        courseDetails?.apply_assignment_group_weights || false;
      let assignmentWeightGroupsWithAssignments =
        await getAssignmentGroupsWithAssignments(courseId);
      if (
        !this.requireForAssignmentsNotAffectingFinalGrade &&
        usesWeightGroups
      ) {
        assignmentWeightGroupsWithAssignments =
          assignmentWeightGroupsWithAssignments.filter((group) => {
            return (group?.group_weight ?? 0) > 0;
          });
      }

      return assignmentWeightGroupsWithAssignments.reduce(
        (assignmentsFromGroups, group) => {
          assignmentsFromGroups.push(...(group?.assignments ?? []));
          return assignmentsFromGroups;
        },
        []
      );
    }

    filterSubmissions(submissions, assignmentsToInclude) {
      return submissions.filter((submission) => {
        // Exclude submissions that aren't for an assignment meeting expectation requirements
        if (
          !assignmentsToInclude.find((assignment) => {
            return assignment?.id == submission?.assignment_id;
          })
        ) {
          return false;
        }

        // Exclude submission that are excused and/or submitted by "Test Student"
        if (submission?.excused || submission?.user?.name == "Test Student") {
          return false;
        }

        // Check if the date is within the timely grading
        const oldestDateTimeAllowed = new Date();
        oldestDateTimeAllowed.setDate(
          oldestDateTimeAllowed.getDate() - this.maxDaysUngraded
        );

        const dueDate = submission?.cached_due_date;
        const submissionDate = submission?.submitted_at;
        const dateToCheck =
          !!dueDate && new Date(dueDate) > new Date(submissionDate)
            ? new Date(dueDate)
            : new Date(submissionDate);
        return dateToCheck < oldestDateTimeAllowed;
      });
    }

    createListOfAssignmentsWithOverdueGradingAsHTML(
      courseId,
      assignments,
      overdueSubmissions
    ) {
      const overdueAssignmentIds = [
        ...new Set(
          overdueSubmissions.map((submission) => {
            return submission?.assignment_id;
          })
        ),
      ];

      const listItems = overdueAssignmentIds.map((id) => {
        const assignment = assignments.find((assignment) => {
          return assignment?.id == id;
        });
        if (!assignment) {
          return "<li>Unknown Assignment</li>";
        }

        return `
          <li>
            <a target='_blank' href='/courses/${courseId}/assignments/${id}'>${assignment?.name}</a>
          </li>
        `;
      });

      return `
        <ul>
          ${listItems.join("")}
        </ul>
      `;
    }
  }

  const expectations = [
    new PublishedCourseExpectation(),
    new CourseDatesExpectation(),
    new SyllabusFileExpectation({
      requirementType: RequirementType.WARNING,
      partialFileLinkText: "syllabus",
      isTeacherRequiredToUploadToCourse: true,
    }),
    new AnnouncementExpectation({
      requirementType: RequirementType.WARNING,
      endAt: Expectation.COURSE_START,
    }),
    new AnnouncementExpectation({
      startAt: 0,
      maxDaysSinceLastPost: 7,
    }),
    new AssignmentDueDatesExpectation(),
    new TimelyGradingExpectation({
      startAt: 0,
    }),
  ];

  if (/^\/courses\/[0-9]+\??[^\/]*\/?$/.test(window.location.pathname)) {
    // Don't load if a student of the course (even if teacher or admin)
    if (isStudentOfThisCourse()) {
      return;
    }

    // Don't load if the user isn't a teacher of the course and they aren't
    // an admin with the necessary permissions
    if (!isTeacherOfThisCourse() && !(isAdmin() && hasNecessaryPermissions())) {
      return;
    }

    const courseId = window.location.pathname.split("/")[2];
    const courseDetails = await getCourseDetails(courseId);
    const termDetails = await getEnrollmentTerm(
      courseDetails?.enrollment_term_id
    );

    // This step can be removed if these expectations should apply to courses in all terms
    // Update this function as needed and/or use other checks to determine if the course should be checked
    if (!isAuditedTerm(termDetails)) {
      console.warn("Not an audited term");
      return;
    }

    // This step will determine the set start and end dates of the course based on the course settings
    const [startDate, endDate] = await getCourseStudentParticipationDates(
      courseId
    );

    const activeExpectations = expectations.filter((expectation) => {
      return expectation.isActiveExpectation(startDate, endDate);
    });

    if (activeExpectations.length == 0) {
      return;
    }

    const topAlertsHolder = addAlertsPlaceholder();
    const rightSideChecklist = addRightSideChecklist();
    const rightSideChecklistLoading = rightSideChecklist.querySelector(
      ".wu-checklist-loading"
    );

    // Check expectations and update alerts and side list
    try {
      const checkedExpectations = [];
      for (const expectation of activeExpectations) {
        checkedExpectations.push(
          loadExpectation(
            expectation,
            courseId,
            topAlertsHolder,
            rightSideChecklistLoading
          )
        );
      }
      await Promise.all(checkedExpectations);
    } catch (error) {
      console.error(`Failed to process all expectations\n${error}`);
    }

    rightSideChecklistLoading.style.display = "none";
  }

  function isTeacherOfThisCourse() {
    return ENV?.COURSE?.is_instructor ?? false;
  }

  function isStudentOfThisCourse() {
    return ENV?.COURSE?.is_student ?? false;
  }

  function isAdmin() {
    return ENV?.current_user_is_admin ?? false;
  }

  async function hasNecessaryPermissions() {
    const courseId = window.location.pathname.split("/")[2];
    const permissions = await getCoursePermissions(courseId);
    return (
      permissions?.read_as_admin &&
      permissions?.read_course_content &&
      permissions?.read_syllabus &&
      permissions?.read_files &&
      permissions?.read_announcements &&
      permissions?.read_roster &&
      permissions?.view_all_grades
    );
  }

  async function getCoursePermissions(courseId) {
    const pageResponse = await getRequestLinksAndResults(
      `${window.location.protocol}//${window.location.hostname}/api/v1/courses/${courseId}/permissions`
    );

    if (pageResponse) {
      return pageResponse?.results;
    } else {
      return {};
    }
  }

  function isAuditedTerm(termDetails) {
    const termTitle = termDetails?.name;
    if (!termTitle) {
      return false;
    }

    return (
      termTitle.includes("Fall") ||
      termTitle.includes("Spring") ||
      termTitle.includes("Summer")
    );
  }

  async function getCourseStudentParticipationDates(courseId) {
    const courseDetails = await getCourseDetails(courseId);
    const term = await getEnrollmentTerm(courseDetails?.enrollment_term_id);

    const useCourseDates = courseDetails?.restrict_enrollments_to_course_dates;
    const startAt = useCourseDates ? courseDetails?.start_at : term?.start_at;
    const endAt = useCourseDates ? courseDetails?.end_at : term?.end_at;
    const startDate = !!startAt ? new Date(startAt) : null;
    const endDate = !!endAt ? new Date(endAt) : null;
    return [startDate, endDate];
  }

  function addAlertsPlaceholder() {
    const recentAnnouncementsDiv = document.getElementById(
      "announcements_on_home_page"
    );
    const courseHomeContentDiv = document.getElementById("course_home_content");
    const topCourseHomeDiv = recentAnnouncementsDiv
      ? recentAnnouncementsDiv
      : courseHomeContentDiv;

    const alertsPlaceholder = document.createElement("div");
    alertsPlaceholder.id = "wu-course-readiness-alerts-wrapper";

    topCourseHomeDiv.insertAdjacentElement("beforebegin", alertsPlaceholder);

    return alertsPlaceholder;
  }

  function createAlert(message, type, isDismissable = true) {
    let color = "#0374B5";
    let icon = `<i class='icon-solid icon-info-borderless' aria-hidden='true'></i>`;
    if (type == AlertType.WARNING) {
      color = "#fc5e13";
      icon = `<i class='icon-solid icon-warning-borderless' aria-hidden='true'></i>`;
    } else if (type == AlertType.ERROR) {
      color = "#e0061f";
      icon = `<i class='icon-solid icon-warning-borderless' aria-hidden='true'></i>`;
    } else if (type == AlertType.INFORMATIONAL) {
      color = "var(--ic-brand-primary)";
    }

    const alert = document.createElement("div");
    alert.style.marginTop = "0.5rem";
    alert.style.marginBottom = "0.5rem";
    alert.style.border = `1px solid ${color}`;
    alert.style.borderRadius = "5px";
    alert.style.display = "flex";
    alert.style.boxSizing = "border-box";

    const iconWrapper = document.createElement("div");
    iconWrapper.style.backgroundColor = color;
    iconWrapper.style.color = "white";
    iconWrapper.style.alignItems = "center";
    iconWrapper.style.display = "flex";
    iconWrapper.style.flex = "0 0 2.5rem";
    iconWrapper.style.justifyContent = "center";
    iconWrapper.innerHTML = icon;

    const alertContentWrapper = document.createElement("div");
    alertContentWrapper.style.minWidth = 0;
    if (!isDismissable) {
      alertContentWrapper.innerHTML = message;
    } else {
      alertContentWrapper.style.flex = "1 1 auto";
      alertContentWrapper.style.display = "flex";
      alertContentWrapper.style.justifyContent = "space-between";
      alertContentWrapper.style.padding = "0.5rem 0.5rem 0.5rem 1rem";

      const messageWrapper = document.createElement("div");
      messageWrapper.style.minWidth = 0;
      messageWrapper.innerHTML = message;

      const dismissButtonWrapper = document.createElement("div");
      dismissButtonWrapper.style.minWidth = "2rem";
      dismissButtonWrapper.style.textAlign = "center";
      const dismissButton = document.createElement("button");
      dismissButton.classList.add("Button", "Button--icon-action");
      dismissButton.innerHTML = `<i class="icon-x" title="Hide this alert"></i>`;
      dismissButton.addEventListener("click", () => {
        alert.style.display = "none";
      });
      dismissButtonWrapper.append(dismissButton);

      alertContentWrapper.append(messageWrapper);
      alertContentWrapper.append(dismissButtonWrapper);
    }

    alert.append(iconWrapper);
    alert.append(alertContentWrapper);

    return alert;
  }

  function addRightSideChecklist() {
    const rightSideChecklist = document.createElement("div");
    rightSideChecklist.classList.add("wu-checklist");
    rightSideChecklist.innerHTML = `
      <div>
        <h2 style="margin-top: 1.0625rem;">
          <span tabindex="-1">
            ${HEADING_FOR_CHECKLIST ?? "Teaching Expectations"}
          </span>
        </h2>
        <span id="wu-checklist-rightside" wrap="normal" letter-spacing="normal">
          <ul class="unstyled">
            <li class="wu-checklist-loading"><i class='icon-Solid icon-info' aria-hidden='true'></i> <em>Loading</em></li>
          </ul>
        </span>
      </div>
    `;

    const courseHomeRightSideButtonsDiv = document.getElementById(
      "course_show_secondary"
    );
    courseHomeRightSideButtonsDiv?.insertAdjacentElement(
      "afterend",
      rightSideChecklist
    );

    return rightSideChecklist;
  }

  function createChecklistItem(message, type, isMet) {
    const listItem = document.createElement("li");
    if (isMet) {
      listItem.classList.add("text-success");
      listItem.innerHTML = `
        <i class='icon-Solid icon-complete' aria-hidden='true'></i> ${message}
      `;
    } else if (type == AlertType.ERROR) {
      listItem.classList.add("text-error");
      listItem.innerHTML = `
        <i class='icon-Solid icon-warning' aria-hidden='true'></i> ${message}
      `;
    } else if (type == AlertType.WARNING) {
      listItem.classList.add("text-warning");
      listItem.style.color = "#856404";
      listItem.innerHTML = `
        <i class='icon-Solid icon-warning' aria-hidden='true'></i> ${message}
      `;
    } else {
      listItem.innerHTML = `
        <i class='icon-Solid icon-info' aria-hidden='true'></i> ${message}
      `;
    }

    return listItem;
  }

  async function loadExpectation(
    expectation,
    courseId,
    topAlert,
    rightSideChecklistLoading
  ) {
    try {
      await expectation.checkExpectation(courseId);
      if (!expectation.isMet) {
        const alert = createAlert(
          expectation.longMessage,
          expectation.messageType
        );
        topAlert.insertAdjacentElement("beforeend", alert);
      }

      const checklistItem = createChecklistItem(
        expectation.shortMessage,
        expectation.messageType,
        expectation.isMet
      );
      rightSideChecklistLoading.insertAdjacentElement(
        "beforebegin",
        checklistItem
      );
    } catch (error) {
      console.error(`Failed to process exception: ${expectation}\n${error}`);
      const checklistItem = createChecklistItem(
        `Error with ${expectation.getName()} check`,
        RequirementType.MANDATORY,
        false
      );
      rightSideChecklistLoading.insertAdjacentElement(
        "beforebegin",
        checklistItem
      );
    }
  }

  async function getRequestLinksAndResults(url) {
    let results = [];
    let links = {};

    const fetches = [];

    fetches.push(
      fetch(url)
        .then((response) => {
          let headerLinks = response.headers.get("link")?.split(",");
          if (headerLinks) {
            for (let link of headerLinks) {
              let splitLink = link.split("; rel=");
              links[splitLink[1].replaceAll('"', "")] = splitLink[0]
                .replace("<", "")
                .replace(">", "");
            }
          }
          return response.json();
        })
        .then((data) => {
          results = data;
        })
        .catch((error) => {
          console.error("Error:", error);
        })
    );

    await Promise.all(fetches);

    return {
      results: results,
      links: links,
    };
  }

  async function getPaginatedRequestResults(url) {
    const completeResults = [];
    let pageResults = {};

    let currentUrl = url;
    do {
      pageResults = await getRequestLinksAndResults(currentUrl);
      if (pageResults.hasOwnProperty("results")) {
        if (Array.isArray(pageResults.results)) {
          completeResults.push(...pageResults.results);
        } else {
          completeResults.push(pageResults.results);
        }
      }

      if (
        pageResults.hasOwnProperty("links") &&
        pageResults.links.hasOwnProperty("next")
      ) {
        currentUrl = pageResults.links.next;
      } else {
        currentUrl = "";
      }
    } while (currentUrl != "");

    return completeResults;
  }

  function memoizeRequest(key, requestFunction) {
    if (cache.has(key)) {
      return cache.get(key);
    }

    cache.set(
      key,
      requestFunction().catch((error) => {
        cache.delete(key);
        return Promise.reject(error);
      })
    );

    return cache.get(key);
  }

  function getCourseDetails(courseId) {
    return memoizeRequest("course-details", () => {
      const url = `/api/v1/courses/${courseId}?include[]=teachers&include[]=syllabus_body`;
      const course = fetch(url)
        .then((response) => {
          return response.json();
        })
        .catch((error) => {
          console.error("Error:", error);
        });
      return course;
    });
  }

  function getEnrollmentTerm(termId) {
    return memoizeRequest(`term_${termId}`, () => {
      const url = `/api/v1/accounts/self/terms/${termId}`;
      const course = fetch(url)
        .then((response) => {
          return response.json();
        })
        .catch((error) => {
          console.error("Error:", error);
        });
      return course;
    });
  }

  function getTabs(courseId) {
    return memoizeRequest("tabs", () => {
      const url = `${window.location.protocol}//${window.location.hostname}/api/v1/courses/${courseId}/tabs?per_page=100`;
      return getPaginatedRequestResults(url);
    });
  }

  function getCourseAnnouncements(courseId) {
    return memoizeRequest("announcements", () => {
      const url = `${window.location.protocol}//${window.location.hostname}/api/v1/courses/${courseId}/discussion_topics?only_announcements=true&per_page=100`;
      return getPaginatedRequestResults(url);
    });
  }

  function getDiscussions(courseId) {
    return memoizeRequest("discussions", () => {
      const url = `${window.location.protocol}//${window.location.hostname}/api/v1/courses/${courseId}/discussion_topics?per_page=100`;
      return getPaginatedRequestResults(url);
    });
  }

  function getAssignmentGroupsWithAssignments(courseId) {
    return memoizeRequest("assignments-in-groups", () => {
      const url = `${window.location.protocol}//${window.location.hostname}/api/v1/courses/${courseId}/assignment_groups?include[]=assignments&include[]=all_dates&per_page=100`;
      return getPaginatedRequestResults(url);
    });
  }

  function getSubmissions(courseId, workflowState) {
    return memoizeRequest(`submissions-${workflowState}`, () => {
      const url = `${window.location.protocol}//${window.location.hostname}/api/v1/courses/${courseId}/students/submissions?student_ids[]=all&workflow_state=${workflowState}&include[]=user&per_page=100`;
      return getPaginatedRequestResults(url);
    });
  }

  async function getFile(courseId, fileId) {
    const url = `/api/v1/courses/${courseId}/files/${fileId}?include[]=user`;
    const fileDetails = await getRequestLinksAndResults(url);
    return fileDetails;
  }

  function convertMsToDays(milliseconds) {
    return milliseconds / 1000 / 60 / 60 / 24;
  }
})();
