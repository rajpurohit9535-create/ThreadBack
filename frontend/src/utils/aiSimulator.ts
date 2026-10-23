// Frontend-only simulated assistant responses for ThreadBack demo
// Clearly marks that this is local mock intelligence, not real external AI API calls.

export interface SimulationResult {
  reply: string;
  suggestedFollowUps: string[];
  suggestedLearningNote: string;
}

export function simulateAssistantReply(question: string, contextTitle: string): Promise<SimulationResult> {
  const q = question.toLowerCase();

  return new Promise((resolve) => {
    // 600ms - 1200ms realistic response delay
    const delay = Math.min(1200, Math.max(600, question.length * 15));

    setTimeout(() => {
      let reply = '';
      let suggestedFollowUps: string[] = [];
      let suggestedLearningNote = '';

      if (q.includes('middleware') || q.includes('interceptor') || q.includes('pipeline')) {
        reply = `Middleware in Go acts as an onion layer around your primary handler. 

Key principles:
1. **Pass or Intercept:** If authorization or validation passes, call \`next.ServeHTTP(w, r)\`. If invalid, write an error code and return immediately.
2. **Context Propagation:** Use \`r.WithContext(ctx)\` to forward decoded session or user IDs to subsequent handlers.
3. **Chaining:** Use a lightweight router like \`chi\` or custom chain helper to keep middleware order clean and maintainable.`;
        suggestedFollowUps = [
          'What is the overhead of request context in Go?',
          'How do I test Go middleware with httptest?',
          'How to order logging, recovery, and auth middleware?'
        ];
        suggestedLearningNote = 'Middleware stops execution early upon invalid input and forwards context down the chain.';
      } else if (q.includes('pool') || q.includes('postgres') || q.includes('database') || q.includes('sql') || q.includes('db')) {
        reply = `Connection pooling keeps a bounded set of database TCP connections live.

Best practices for Go & PostgreSQL:
- Set \`SetMaxOpenConns\` to around 2-4x your CPU core count unless using an external pooler like PgBouncer.
- Set \`SetMaxIdleConns\` equal to or slightly lower than max open connections to avoid connection churn.
- Set \`SetConnMaxLifetime\` to prevent stale sockets across network switches.

This prevents RAM exhaustion while delivering microsecond latency for CRUD transactions.`;
        suggestedFollowUps = [
          'When should we use PgBouncer with Go?',
          'What happens when all connections in the pool are busy?',
          'How to monitor connection pool health metrics?'
        ];
        suggestedLearningNote = 'Connection pooling bounds active connections to protect database RAM while eliminating TCP handshake latency.';
      } else if (q.includes('error') || q.includes('validation') || q.includes('validate')) {
        reply = `For input validation in a CRUD API:
1. Decode the JSON body into a strongly-typed request struct.
2. Use validation tags or a validator function to check constraints (e.g., non-empty strings, valid email formats).
3. If errors occur, return a structured 400 Bad Request response with specific field error details.
4. Only initiate database calls when the payload is 100% verified.`;
        suggestedFollowUps = [
          'Should we validate in middleware or controller handlers?',
          'How to structure standardized JSON error responses in Go?'
        ];
        suggestedLearningNote = 'Validate request structs before hitting the repository to prevent unnecessary database queries and SQL errors.';
      } else {
        reply = `Here is a breakdown regarding **"${question}"** within the context of **${contextTitle}**:

- **Core Concept:** Addressing this allows you to decouple complex edge-cases from your primary mission objective.
- **Immediate Impact:** Clarifies how data and control flow interact without blocking the primary milestone.
- **Recommended Approach:** Keep the implementation minimal first, log any unexpected edge cases, and verify compatibility with existing constraints.

*(Simulated response generated locally by ThreadBack demo engine)*`;
        suggestedFollowUps = [
          `How does ${question.slice(0, 30)} affect performance?`,
          `What are the best practices for this in production?`,
          `How can we test this in isolation?`
        ];
        suggestedLearningNote = `Explored "${question.slice(0, 45)}...": identified clean separation of concerns and minimal implementation path.`;
      }

      resolve({
        reply,
        suggestedFollowUps,
        suggestedLearningNote,
      });
    }, delay);
  });
}
