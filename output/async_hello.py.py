import asyncio

async def async_hello(repeat: int = 1) -> None:
    """异步输出hello world多次"""
    for _ in range(repeat):
        print('hello world')
        await asyncio.sleep(0.1)

# 测试用例
if __name__ == '__main__':
    asyncio.run(async_hello(3))