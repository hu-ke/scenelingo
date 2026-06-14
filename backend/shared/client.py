import os

from openai import OpenAI


def get_client():
    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise Exception("DASHSCOPE_API_KEY environment variable is not set")
    return OpenAI(
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        api_key=api_key,
    )