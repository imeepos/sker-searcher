def greet(*, prefix: str = '') -> None:
    """带前缀的hello world输出，支持异常捕获。"""
    try:
        print(f'{prefix}hello world')
    except Exception as e:
        print(f'Error occurred: {e}')

if __name__ == '__main__':
    greet(prefix='Debug: ')