# Build Queue System - Test Checklist

## Prerequisites
- [ ] Google Sheets set up with 5 tabs and sample data
- [ ] Service account credentials in .env
- [ ] n8n workflow imported and activated
- [ ] Server running on http://localhost:3000

## Test 1: Load Dashboard
- [ ] Open http://localhost:3000/build-queue.html
- [ ] Client dropdown populated (Prince, Kyle, Juan, etc. visible)
- [ ] Filters show team members (Vee, Lee, JOHN, Adam, Jameel)
- [ ] Task table shows "No tasks found" or existing tasks

## Test 2: Process Transcript with AI
- [ ] Select a client from dropdown (e.g., "Kyle")
- [ ] Paste sample transcript:
  ```
  Kyle mentioned that the GHL reminder email has a bug where it shows "brackets, first name" instead of the actual name. He wants this fixed ASAP. Also, his mom got the wrong automation email for an event when she should have gotten a purchase confirmation. This needs to be investigated and stopped.
  ```
- [ ] Click "Process with AI"
- [ ] Spinner shows "Processing..."
- [ ] AI output appears with formatted task document
- [ ] Parsed tasks table shows extracted tasks
- [ ] Assignees auto-suggested correctly (Kyle tasks → Lee)
- [ ] Priority levels assigned correctly

## Test 3: Create Tasks
- [ ] Click "Confirm & Create Tasks"
- [ ] Success message: "Successfully created X tasks!"
- [ ] Tasks appear in task table
- [ ] Check Google Sheet - tasks visible in "Build Queue" tab
- [ ] Task IDs increment correctly
- [ ] All fields populated (Priority, Client, System, Status, Assigned To, Date Added)
- [ ] Check Telegram - notification received (if n8n workflow is active)

## Test 4: Filter Tasks
- [ ] Filter by Client: Select a specific client → Only that client's tasks shown
- [ ] Filter by Status: "Not Started" → Only not-started tasks
- [ ] Filter by Assignee: Select a team member → Only their tasks
- [ ] Filter by Priority: "Critical" → Only critical tasks
- [ ] Clear all filters → All tasks shown
- [ ] Multiple filters combined work correctly

## Test 5: Update Task Status
- [ ] Click "Edit" on a task
- [ ] Modal opens with task details
- [ ] Change status to "In Progress"
- [ ] Click "Save Changes"
- [ ] Modal closes
- [ ] Task table updates with new status
- [ ] Google Sheet updates (check "Build Queue" tab)
- [ ] Telegram notification received (task_updated event)

## Test 6: Complete Task
- [ ] Click "Edit" on a task
- [ ] Change status to "Done"
- [ ] Save
- [ ] "Date Completed" populates in Google Sheet
- [ ] Telegram notification: "Task Completed" with celebration emoji
- [ ] Task marked with green "Done" badge

## Test 7: Reassign Task
- [ ] Click "Edit" on a task
- [ ] Change "Reassign to" dropdown to different team member
- [ ] Save
- [ ] Task shows new assignee in table
- [ ] Google Sheet updates
- [ ] Notification sent

## Test 8: AI Fallback (Claude → OpenAI)
**Only if you want to test failover:**
- [ ] Temporarily set CLAUDE_API_KEY to invalid value in .env
- [ ] Restart server: `node server.js`
- [ ] Process a transcript
- [ ] Check server console: Should see "Claude failed, falling back to OpenAI"
- [ ] OpenAI should succeed and tasks should be parsed
- [ ] Restore valid CLAUDE_API_KEY
- [ ] Restart server

## Test 9: Assignment Rules
- [ ] Process transcript for "Prince" client
- [ ] Tasks should auto-assign to "Vee" (from Client rules)
- [ ] Process transcript mentioning "GHL"
- [ ] Tasks should auto-suggest "Adam" (from System rules)
- [ ] Test time-based rule (if current time is after 9pm):
  - [ ] Prince tasks should assign to "JOHN" instead of "Vee"

## Test 10: Config Changes (Future-Proofing)
- [ ] Add new client to "Clients" sheet: `Thomas | Lee | | Yes | Medium`
- [ ] Refresh dashboard (or wait 5 min for cache to expire)
- [ ] "Thomas" appears in client dropdown
- [ ] Add new team member to "Team Members" sheet
- [ ] New member appears in assignee dropdowns
- [ ] Add new assignment rule
- [ ] Rule takes effect for new tasks

## Test 11: Error Handling
- [ ] Try processing empty transcript → Should show error alert
- [ ] Try processing without selecting client → Should show error alert
- [ ] Try updating non-existent task → Should show 404 error
- [ ] Check server console - errors logged clearly

## Test 12: Multi-Client Support
- [ ] Process transcripts for different clients (Kyle, Prince, Juan)
- [ ] Each client's tasks assign to correct team members
- [ ] Filter by each client - only their tasks shown
- [ ] Verify system works for any client, not just Prince

## Test 13: Server Startup
- [ ] Stop server (Ctrl+C)
- [ ] Start server: `node server.js`
- [ ] Check console output: "Build Queue server running on http://localhost:3000"
- [ ] No error messages on startup
- [ ] Dashboard loads successfully

---

## All Tests Passed?
- [ ] **YES** → System is ready for production use! 🎉
- [ ] **NO** → Note failing tests below and debug

### Failed Tests & Notes:
```
(Record any failures here)
```

---

## Next Steps After Testing

1. **Deploy to production** (Task 12)
2. **Train team** on using the dashboard
3. **Monitor AI output quality** (Claude vs OpenAI)
4. **Gather feedback** and adjust assignment rules
5. **Set up automated backups** of Google Sheet

## Performance Benchmarks

Expected timings:
- AI processing: 3-10 seconds
- Task creation: 1-3 seconds
- Page load: < 1 second
- Filter updates: Instant

If slower, check:
- Google Sheets API rate limits
- Network connectivity
- API key validity
