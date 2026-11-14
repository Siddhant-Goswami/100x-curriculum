"""Instructor only: one way to make case 6 (which lectures use Supabase) pass. Paste into tools.py, add the card
to CARDS and the function to FUNCTIONS. Not handed out: writing this tool is the practice set."""


def find_lectures(tool: str, track: str) -> dict:
    """Every lecture of one track whose tools cell names this tool."""
    found = [{"number": x["number"], "title": x["title"]} for x in fetch_lectures(check_track(track))
             if tool.lower() in x["tools"].lower()]
    return {"track": track, "tool": tool, "lectures": found}


CARD = {"type": "function", "function": {
    "name": "find_lectures",
    "description": "Returns every lecture of one track that uses a given tool, for example Supabase. "
                   "Use it when the question asks which lectures use, teach or cover a tool.",
    "parameters": {"type": "object", "properties": {
        "tool": {"type": "string", "description": "The tool's name, for example Supabase."},
        "track": {"type": "string", "description": "Which track: code or no-code."}}, "required": ["tool", "track"]},
}}
