// src/components/scopecraft/ResultView.tsx
import { ScopeCraftResponse } from "@/lib/scopecraft/schema";

export function ResultView({ data }: { data: ScopeCraftResponse }) {
  return (
    <div>
      <section>
        <h2>Problem</h2>
        <p>{data.problem}</p>
        <h3>Target user</h3>
        <p>{data.target_user}</p>
      </section>

      <section>
        <h3>Goals</h3>
        <ul>{data.goals.map((g, i) => <li key={i}>{g}</li>)}</ul>
        <h3>Non-goals</h3>
        <ul>{data.non_goals.map((g, i) => <li key={i}>{g}</li>)}</ul>
      </section>

      <section>
        <h3>User stories</h3>
        {data.user_stories.length === 0 && <p>No stories generated yet.</p>}
        <ul>
          {data.user_stories.map((s) => (
            <li key={s.id}>
              As a {s.as_a}, I want {s.i_want}, so that {s.so_that}
              <ul>
                {s.acceptance_criteria.map((ac, i) => <li key={i}>✓ {ac}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Risks</h3>
        <ul>
          {data.risks.map((r) => (
            <li key={r.id}>
              {r.description} (impact: {r.impact}, likelihood: {r.likelihood})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Sprint plan</h3>
        <table>
          <thead>
            <tr><th>Story</th><th>Priority</th><th>Effort</th><th>Sprint</th></tr>
          </thead>
          <tbody>
            {data.sprint.map((s, i) => (
              <tr key={i}>
                <td>{s.story_id}</td>
                <td>{s.priority_score}</td>
                <td>{s.effort}</td>
                <td>{s.sprint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
