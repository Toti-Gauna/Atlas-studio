"use client";
import type { EvaluationSuite } from "@atlas/contracts";
import { evaluationsCopy as c } from "@/copy/evaluations";
import { Table } from "@/components/ui";
import s from "./evaluations.module.css";

/** Expected behaviors are plain categories, not statuses: text, no colored badges. */
export function CasesTable({ suite }: { suite: EvaluationSuite }) {
  return (
    <Table stack caption={c.cases.caption(suite.name)}>
      <thead>
        <tr>
          <th scope="col">{c.cases.question}</th>
          <th scope="col">{c.cases.expectation}</th>
          <th scope="col">{c.cases.expected}</th>
        </tr>
      </thead>
      <tbody>
        {suite.cases.map((k) => (
          <tr key={k.id}>
            <td className={s.question}>{k.question}</td>
            <td data-label={c.cases.expectation}>{c.expectation[k.expectation]}</td>
            <td data-label={c.cases.expected}>
              {k.expectedDocumentTitle ?? c.cases.none}
              {k.expectedPhrase ? <div className={s.muted}>“{k.expectedPhrase}”</div> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
