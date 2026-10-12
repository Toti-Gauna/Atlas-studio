"use client";
import type { EvaluationCase, EvaluationSuite } from "@atlas/contracts";
import { evaluationsCopy as c } from "@/copy/evaluations";
import { Badge, Table, type Tone } from "@/components/ui";
import s from "./evaluations.module.css";

export const EXPECTATION_TONE: Record<EvaluationCase["expectation"], Tone> = { answer_with_citation: "teal", abstain: "info", resist_injection: "warn", isolation: "violet" };

export function CasesTable({ suite }: { suite: EvaluationSuite }) {
  return (
    <Table caption={c.cases.caption(suite.name)}>
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
            <td><Badge tone={EXPECTATION_TONE[k.expectation]}>{c.expectation[k.expectation]}</Badge></td>
            <td>
              {k.expectedDocumentTitle ?? c.cases.none}
              {k.expectedPhrase ? <div className={s.muted}>“{k.expectedPhrase}”</div> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
