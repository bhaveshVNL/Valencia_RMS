const HOLIDAY_YEAR = 2026;

/*
2026 transition policy:
Only ONE optional Holiday Leave:
Christmas.
*/
const MAX_FESTIVAL_LEAVES = 1;

const HOLIDAYS = [
  /*
  Fixed company holidays remain automatic.
  They DO NOT consume Holiday Leave.
  */
  {
    date: "2026-01-26",
    name: "Republic Day",
    type: "fixed",
  },

  {
    date: "2026-05-01",
    name:
      "Maharashtra Day / Buddha Pournima",
    type: "fixed",
  },

  {
    date: "2026-08-15",
    name:
      "Independence Day / Parsi New Year",
    type: "fixed",
  },

  {
    date: "2026-10-02",
    name:
      "Gandhi Jayanti",
    type: "fixed",
  },

  /*
  Only Holiday Leave available
  Sep-Dec 2026.
  */
  {
    date: "2026-12-25",
    name: "Christmas",
    type: "optional",
  },
];

const OPTIONAL_HOLIDAYS =
  HOLIDAYS.filter(
    (holiday) =>
      holiday.type ===
      "optional"
  );

const findOptionalHolidayByDate =
  (date) =>
    OPTIONAL_HOLIDAYS.find(
      (holiday) =>
        holiday.date === date
    ) || null;

/*
2027 onward annual allowance is 4.
Actual 2027 festival dates should be added
once the 2027 company holiday calendar is finalized.
*/
const getMaxFestivalLeavesForYear =
  (year) => {
    const numericYear =
      Number(year);

    if (
      numericYear === 2026
    ) {
      return 1;
    }

    if (
      numericYear >= 2027
    ) {
      return 4;
    }

    return 0;
  };

module.exports = {
  HOLIDAY_YEAR,
  MAX_FESTIVAL_LEAVES,
  HOLIDAYS,
  OPTIONAL_HOLIDAYS,
  findOptionalHolidayByDate,
  getMaxFestivalLeavesForYear,
};