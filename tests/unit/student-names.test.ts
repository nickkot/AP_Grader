import { describe, expect, it } from "vitest";

import { orderSheets } from "@/lib/packet/order";
import { compareStudents, rosterLabel, studentName } from "@/lib/student-names";
import { redactText } from "@/lib/ai/redact";

const maya = { firstName: "Maya", lastName: "Chen" };
const numbered = (n: number) => ({ firstName: "", lastName: "", number: n });

describe("student names", () => {
  it("shows names in a named class", () => {
    expect(studentName(maya)).toBe("Maya Chen");
    expect(rosterLabel(maya)).toBe("Chen, Maya");
    expect(rosterLabel({ firstName: "Cher", lastName: "" })).toBe("Cher");
  });

  it("shows only the number in a numbered class", () => {
    expect(studentName(numbered(12))).toBe("Student 12");
    expect(rosterLabel(numbered(12))).toBe("Student 12");
  });

  it("sorts numbered students by number, not as text", () => {
    const sorted = [numbered(10), numbered(2), numbered(1)].sort(compareStudents);
    expect(sorted.map((s) => s.number)).toEqual([1, 2, 10]);
  });

  it("prints the number on packets", () => {
    const students = [
      { id: "b", ...numbered(2), rosterIndex: 1 },
      { id: "a", ...numbered(10), rosterIndex: 0 },
    ];
    const tokens = [
      { token: "T1", studentId: "a", pageNumber: 1 },
      { token: "T2", studentId: "b", pageNumber: 1 },
    ];
    const sheets = orderSheets({ students, tokens, order: "alphabetical", pagesPerStudent: 1 });
    expect(sheets.map((s) => s.studentName)).toEqual(["Student 2", "Student 10"]);
  });

  it("leaves essay text alone when the roster has no names", () => {
    const text = "Student 3\nJackson vetoed the bank in 1832.";
    expect(redactText(text, numbered(3), [numbered(3), numbered(4)])).toBe(text);
  });
});
