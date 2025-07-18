// ==UserScript==
// @name         Show User Enrollment Expected End Date
// @namespace    https://github.com/Wilmington-University-Ed-Tech-Systems/Shared-Custom-Developments/tree/main/Canvas%20LMS/Theme%20Mods%20and%20User%20Scripts/Show%20User%20Enrollment%20Expected%20End%20Date
// @version      1.0.0
// @description  On a user's details page within a course, it will load in the expected completion date for memberships that are not yet completed.
// @author       James Sekcienski, Ed Tech Systems, Wilmington University
// @match      https://*.instructure.com/courses/*/users/*
// ==/UserScript==

"use strict";

(async () => {
  if (
    /^\/courses\/[0-9]+\/users\/[0-9]+\??[^\/]*\/?$/.test(
      window.location.pathname
    )
  ) {
    const permissions = await getCoursePermissions();
    const hasRequiredPermissions =
      hasRequiredPermissionsForFeature(permissions);
    if (!hasRequiredPermissions) {
      return;
    }

    const courseId = window.location.pathname.split("/")[2];
    const course = await getCourseDetails(courseId);
    const sections = await getSections(courseId, false);
    if (sections) {
      course.sections = sections;
    }
    const termId = course?.enrollment_term_id;
    const term = await getEnrollmentTerm(termId);
    if (term) {
      course.term = term;
    }

    const userId = window.location.pathname.split("/")[4];
    const user = await getUserWithEnrollments(courseId, userId);

    watchForMemberships(course, user);
  }

  async function getCoursePermissions() {
    const courseId = window.location.pathname.split("/")[2];
    const url = `/api/v1/courses/${courseId}/permissions`;
    return fetch(url)
      .then((response) => response.json())
      .catch((error) => console.error(error));
  }

  function hasRequiredPermissionsForFeature(permissions) {
    return permissions?.read_as_admin && !permissions?.participate_as_student;
  }

  async function getCourseDetails(courseId) {
    const url = `/api/v1/courses/${courseId}?include[]=term&include[]=concluded`;
    const course = await fetch(url)
      .then((response) => response.json())
      .catch((error) => console.error(error));
    return course;
  }

  async function getEnrollmentTerm(termId) {
    const url = `/api/v1/accounts/self/terms/${termId}`;
    const course = await fetch(url)
      .then((response) => response.json())
      .catch((error) => console.error(error));
    return course;
  }

  async function getSections(courseId, convertToDict = true) {
    const url = `/api/v1/courses/${courseId}/sections?per_page=100`;
    const sections = await getPaginatedRequestResults(url);
    if (!convertToDict) {
      return sections;
    }

    const sectionsById = {};
    for (const section of sections) {
      sectionsById[`${section?.id}`] = section;
    }
    return sectionsById;
  }

  async function getUserWithEnrollments(courseId, userId) {
    const url = `/api/v1/courses/${courseId}/users/${userId}?include[]=enrollments`;
    const user = await fetch(url)
      .then((response) => response.json())
      .catch((error) => console.error(error));
    return user;
  }

  function watchForMemberships(course, user) {
    if (
      document.querySelector(
        "#content .more_user_information table tr.enrollment"
      )
    ) {
      addExpectedEndDates(course, user);
      return;
    }

    const observer = new MutationObserver((mutations) => {
      if (
        !mutations.some((mutation) => (mutation?.addedNodes?.length ?? 0) > 0)
      ) {
        return;
      }

      if (
        document.querySelector(
          "#content .more_user_information table tr.enrollment"
        )
      ) {
        addExpectedEndDates(course, user);
        observer.disconnect();
        return;
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function addExpectedEndDates(course, user) {
    const enrollmentRows = [
      ...document.querySelectorAll(
        "#content .more_user_information table tbody > tr.enrollment"
      ),
    ];
    for (const row of enrollmentRows) {
      addAnticipatedEnrollmentEndDateToRow(row, course, user);
    }
  }

  function addAnticipatedEnrollmentEndDateToRow(row, course, user) {
    const completedAtHolder = row?.querySelector("td > .completed_at_holder");
    if (completedAtHolder?.style?.display != "none") {
      return;
    }

    const deleteLink = row.querySelector("a.delete_enrollment_link");
    if (!deleteLink) {
      return;
    }
    const splitDeleteLinkHref = deleteLink?.href?.split("/");
    if (splitDeleteLinkHref.length < 5) {
      return;
    }
    const enrollmentId = splitDeleteLinkHref[0].startsWith("https")
      ? splitDeleteLinkHref[6]
      : splitDeleteLinkHref[4];

    completedAtHolder.insertAdjacentHTML(
      "afterend",
      `
      <div>
        <em>Expected Completion: ${getExpectedEndDate(
          enrollmentId,
          course,
          user
        )}
      </div>
    `
    );
  }

  function getExpectedEndDate(enrollmentId, course, user) {
    const enrollment = user?.enrollments?.find(
      (enrollment) => enrollmentId == enrollment?.id
    );
    if (!enrollment) {
      return "Error getting enrollment";
    }

    if (enrollment?.enrollment_state != "active") {
      return "Enrollment is not active";
    }

    const enrollmentStartAt = enrollment?.start_at;
    const enrollmentEndAt = enrollment?.end_at;
    if (enrollmentStartAt && enrollmentEndAt) {
      const enrollmentEndAtDate = new Date(enrollmentEndAt);
      return enrollmentEndAtDate.toLocaleString();
    }

    // Check for override end at date
    // Non-student overrides will override course and section specific dates if they provide longer access
    const role = enrollment?.role ?? "";
    const overrides = course?.term?.overrides ?? {};
    const hasOverrideForRole = overrides.hasOwnProperty(role);
    const overrideEndAtDate =
      hasOverrideForRole && overrides[role]?.end_at
        ? new Date(overrides[role]?.end_at)
        : null; // When null the term end date should be used instead

    const sectionId = enrollment?.course_section_id;
    const section = course?.sections?.find(
      (section) => sectionId == section.id
    );
    if (section && section?.restrict_enrollments_to_section_dates) {
      const sectionStartAt = section?.start_at;
      const sectionEndAt = section?.end_at;
      if (sectionStartAt && sectionEndAt) {
        const sectionEndAtDate = new Date(sectionEndAt);
        if (
          !hasOverrideForRole ||
          role == "StudentEnrollment" ||
          (overrideEndAtDate && overrideEndAtDate < sectionEndAtDate)
        ) {
          return sectionEndAtDate.toLocaleString();
        }
      }
    }

    if (course?.restrict_enrollments_to_course_dates) {
      const courseEndAt = course?.end_at;
      if (courseEndAt) {
        const courseEndAtDate = new Date(courseEndAt);
        if (
          !hasOverrideForRole ||
          role == "StudentEnrollment" ||
          (overrideEndAtDate && overrideEndAtDate < courseEndAtDate)
        ) {
          return courseEndAtDate.toLocaleString();
        }
      } else {
        return "No course end date";
      }
    }

    // Check Override Term Enrollment Date
    if (hasOverrideForRole && overrideEndAtDate) {
      return overrideEndAtDate.toLocaleString();
    }

    // Check General Term Enrollment Date
    const termEndAt = course?.term?.end_at;
    if (termEndAt) {
      const termEndAtDate = new Date(termEndAt);
      return termEndAtDate.toLocaleString();
    } else {
      return "No term end date";
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
})();
