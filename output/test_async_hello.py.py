import pytest
from async_hello import async_hello

@pytest.mark.asyncio
async def test_async_hello(capsys):
    await async_hello(2)
    captured = capsys.readouterr()
    assert captured.out.count('hello world') == 2