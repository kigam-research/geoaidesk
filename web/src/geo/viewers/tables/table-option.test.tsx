import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TableInspectionOption } from "./table-option";
vi.mock("./table-roles-viewer", () => ({ default: () => <div>Semantic table</div> }));
it("keeps the generic table by default and offers semantics only on explicit choice", async () => {
  render(<TableInspectionOption path="assay.csv" name="assay.csv" content="a,b" projectId="p"><div>Original table</div></TableInspectionOption>);
  expect(screen.getByText("Original table")).toBeInTheDocument();
  expect(screen.queryByText("Semantic table")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Inspect drillhole table"));
  expect(await screen.findByText("Semantic table")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Standard table view"));
  expect(screen.getByText("Original table")).toBeInTheDocument();
});
it("leaves non-table files untouched", () => {
  render(<TableInspectionOption path="note.md" name="note.md" content="text"><p>Markdown</p></TableInspectionOption>);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByText("Markdown")).toBeInTheDocument();
});
