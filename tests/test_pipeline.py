from __future__ import annotations

import csv
import json
import tempfile
import unittest
from pathlib import Path

from schema_alignment import AlignmentPlan, PlannedColumn, build_alignment_plan, export_aligned_csv


class AlignmentPipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def csv_file(self, name: str, content: str) -> Path:
        path = self.root / name
        path.write_text(content, encoding="utf-8")
        return path

    def read_output(self, path: Path) -> tuple[list[str], list[dict[str, str]]]:
        with path.open("r", encoding="utf-8", newline="") as stream:
            reader = csv.DictReader(stream)
            return list(reader.fieldnames or []), list(reader)

    def test_global_inference_groups_three_file_headers(self) -> None:
        files = [
            self.csv_file("one.csv", "name,phone\nAda,555-0101\n"),
            self.csv_file("two.csv", "full_name,phone_number,region\nAda,555-0101,west\n"),
            self.csv_file("three.csv", "contact_name,phone,extra\nAda,555-0101,x\n"),
        ]
        plan = build_alignment_plan(files, infer_schema=True)
        name_group = next(column for column in plan.columns if column.sources[str(files[0])] == "name")
        phone_group = next(column for column in plan.columns if column.sources[str(files[0])] == "phone")
        self.assertEqual(name_group.sources[str(files[1])], "full_name")
        self.assertEqual(name_group.sources[str(files[2])], "contact_name")
        self.assertEqual(phone_group.sources[str(files[1])], "phone_number")
        self.assertEqual(phone_group.sources[str(files[2])], "phone")
        self.assertEqual(len(plan.files), 3)

    def test_reference_mode_preserves_order_and_appends_file_specific_extras(self) -> None:
        files = [
            self.csv_file("base.csv", "id,name\n1,Ada\n"),
            self.csv_file("later.csv", "person_id,full_name,west_field\n1,Ada,W\n"),
            self.csv_file("last.csv", "id,name,east_field\n2,Lin,E\n"),
        ]
        plan = build_alignment_plan(files, infer_schema=False)
        self.assertEqual([column.name for column in plan.columns[:2]], ["id", "name"])
        self.assertEqual([column.name for column in plan.columns[-2:]], ["west_field", "east_field"])
        output = export_aligned_csv(plan, self.root / "nested" / "merged.csv")
        fields, rows = self.read_output(output)
        self.assertEqual(fields, [column.name for column in plan.columns])
        self.assertEqual(rows[0]["west_field"], "")
        self.assertEqual(rows[1]["west_field"], "W")
        self.assertEqual(rows[2]["west_field"], "")
        self.assertEqual(rows[2]["east_field"], "E")

    def test_reference_mode_keeps_normalized_equivalent_extras_separate(self) -> None:
        files = [
            self.csv_file("base.csv", "id\n1\n"),
            self.csv_file("one.csv", "id,Extra-Field\n1,a\n"),
            self.csv_file("two.csv", "id,extra field\n2,b\n"),
        ]
        plan = build_alignment_plan(files, infer_schema=False)
        extras = plan.columns[1:]
        self.assertEqual(len(extras), 2)
        self.assertEqual(extras[0].sources[str(files[1])], "Extra-Field")
        self.assertIsNone(extras[0].sources[str(files[2])])
        self.assertEqual(extras[1].sources[str(files[2])], "extra field")
        self.assertIsNone(extras[1].sources[str(files[1])])

    def test_generated_names_are_unique_when_source_basenames_collide(self) -> None:
        base = self.csv_file("base.csv", "id\n1\n")
        first_dir = self.root / "first"
        second_dir = self.root / "second"
        third_dir = self.root / "third"
        first_dir.mkdir()
        second_dir.mkdir()
        third_dir.mkdir()
        first = first_dir / "same.csv"
        second = second_dir / "same.csv"
        third = third_dir / "same.csv"
        first.write_text("id,extra\n1,a\n", encoding="utf-8")
        second.write_text("id,extra\n2,b\n", encoding="utf-8")
        third.write_text("id,extra\n3,c\n", encoding="utf-8")
        plan = build_alignment_plan([base, first, second, third], infer_schema=False)
        self.assertEqual([column.name for column in plan.columns[1:]], ["extra", "extra [same.csv]", "extra [same.csv] #2"])
    def test_plan_is_editable_and_json_roundtrips(self) -> None:
        files = [self.csv_file("a.csv", "name\nAda\n"), self.csv_file("b.csv", "full_name\nAda\n")]
        plan = build_alignment_plan(files)
        plan.columns[0].name = "Person"
        restored = AlignmentPlan.from_dict(json.loads(json.dumps(plan.to_dict())))
        self.assertEqual(restored.columns[0].name, "Person")
        self.assertEqual(restored.to_dict(), plan.to_dict())
        self.assertIsInstance(restored.columns[0], PlannedColumn)

    def test_export_concatenates_rows_and_leaves_unmapped_fields_blank(self) -> None:
        files = [
            self.csv_file("a.csv", "name,unused\nAda,x\nLin,y\n"),
            self.csv_file("b.csv", "full_name\nMira\n"),
        ]
        plan = build_alignment_plan(files, infer_schema=False)
        output = export_aligned_csv(plan, self.root / "result.csv")
        fields, rows = self.read_output(output)
        name = plan.columns[0].name
        self.assertEqual(len(rows), 3)
        self.assertEqual([row[name] for row in rows], ["Ada", "Lin", "Mira"])
        self.assertEqual(fields, [column.name for column in plan.columns])
        self.assertNotIn("_source_file", fields)
        self.assertEqual(rows[0][plan.columns[-1].name], "x")
        self.assertEqual(rows[2][plan.columns[-1].name], "")

    def test_source_file_field_is_opt_in(self) -> None:
        files = [self.csv_file("alpha.csv", "id\n1\n"), self.csv_file("beta.csv", "id\n2\n")]
        plan = build_alignment_plan(files)
        output = export_aligned_csv(plan, self.root / "with-source.csv", include_source_file=True)
        fields, rows = self.read_output(output)
        self.assertEqual(fields[0], "_source_file")
        self.assertEqual([row["_source_file"] for row in rows], ["alpha.csv", "beta.csv"])

    def test_invalid_input_and_plan_conditions_raise_value_error(self) -> None:
        one = self.csv_file("one.csv", "id\n1\n")
        with self.assertRaisesRegex(ValueError, "at least two"):
            build_alignment_plan([one])
        with self.assertRaisesRegex(ValueError, "positive"):
            build_alignment_plan([one, self.csv_file("two.csv", "id\n2\n")], sample_size=0)
        with self.assertRaisesRegex(ValueError, "distinct"):
            build_alignment_plan([one, one])
        no_header = self.csv_file("empty.csv", "")
        with self.assertRaisesRegex(ValueError, "header"):
            build_alignment_plan([one, no_header])
        duplicate_headers = self.csv_file("duplicate.csv", "id,id\n1,2\n")
        with self.assertRaisesRegex(ValueError, "duplicate headers"):
            build_alignment_plan([one, duplicate_headers])

        plan = build_alignment_plan([one, self.csv_file("two.csv", "id\n2\n")])
        with self.assertRaisesRegex(ValueError, "unique"):
            export_aligned_csv(AlignmentPlan(plan.files, plan.infer_schema, [plan.columns[0], PlannedColumn(plan.columns[0].name, dict(plan.columns[0].sources), dict(plan.columns[0].confidence))]), self.root / "dupe.csv")
        bad_source = build_alignment_plan([one, self.csv_file("three.csv", "id\n3\n")])
        bad_source.columns[0].sources[str(one)] = "missing"
        with self.assertRaisesRegex(ValueError, "does not exist"):
            export_aligned_csv(bad_source, self.root / "bad-source.csv")
        reused_source = build_alignment_plan([one, self.csv_file("four.csv", "id\n4\n")])
        reused_source.columns.append(PlannedColumn("second", {reused_source.files[0]: "id"}))
        with self.assertRaisesRegex(ValueError, "mapped to multiple"):
            export_aligned_csv(reused_source, self.root / "reused.csv")
        with self.assertRaisesRegex(ValueError, "input CSV"):
            export_aligned_csv(plan, one)

    def test_reserved_source_field_collision_is_rejected(self) -> None:
        files = [self.csv_file("a.csv", "id\n1\n"), self.csv_file("b.csv", "id\n2\n")]
        plan = build_alignment_plan(files)
        plan.columns[0].name = "_source_file"
        with self.assertRaisesRegex(ValueError, "reserved source field"):
            export_aligned_csv(plan, self.root / "collision.csv", include_source_file=True)


if __name__ == "__main__":
    unittest.main()
