# 腾讯云直播录制 webhook 数据

```json
{
	"app": "201782.push.tlivecloud.com",
	"appid": 1324682537,
	"appname": "live",
	"callback_ext": "{\"video_codec\":\"h264\",\"session_id\":\"1820625260475124043\",\"resolution\":\"1920x1080\"}",
	"channel_id": "119",
	"duration": 60,
	"end_time": 1743484153,
	"end_time_usec": 809196,
	"event_type": 100,
	"file_format": "hls",
	"file_id": "1324682537_783c543e415d41a8a4c16da76f83eb81",
	"file_size": 31869806,
	"media_start_time": 80,
	"record_bps": 0,
	"record_file_id": "1324682537_783c543e415d41a8a4c16da76f83eb81",
	"record_temp_id": "1569294",
	"start_time": 1743484094,
	"start_time_usec": 224855,
	"stream_id": "119",
	"stream_param": "txFrom=pullpush&upstream_sequence=2210381016636308286&txHost=201782.push.tlivecloud.com&ppTaskId=106403876",
	"task_id": "1820625260475124043",
	"video_id": "1324682537_31b9a34e99f6423b94f52812ebf3ab70",
	"video_url": "http://merge-local-1324682537.cos.ap-shanghai.myqcloud.com/streams/119/2025-04-01-13-08-14_eof.m3u8"
}
```

# 数据库表结构

```ts
import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	Unique,
	UpdateDateColumn,
} from "typeorm";

@Entity({
	name: "loc_live_record",
})
@Unique("loc_lvie_record_project_id_url", ["projectId", "url"])
export class LiveRecord {
	@PrimaryGeneratedColumn({
		primaryKeyConstraintName: "pk_loc_live_record",
	})
	id: number;

	@Column({
		type: "int",
		default: 0,
		name: "project_id",
	})
	projectId: number;

	@Column({
		type: "int",
		comment: "毫秒",
		default: 0,
	})
	duration: number;

	@Column({
		type: "varchar",
		length: 255,
		default: "",
		comment: "cos的key",
	})
	url: string;

	@Column({
		type: "varchar",
		length: 255,
		default: "",
		name: "task_id",
	})
	taskId: string;

	@CreateDateColumn({
		name: "create_date",
	})
	createDate: Date;

	@UpdateDateColumn({
		name: "update_date",
	})
	updateDate: Date;
}
```

# 原则：如无必要，务增依赖

# 需求
根据 webhook 传过来的数据，写一个函数实现一下功能

1. stream_id 对应数据库的 project_id
2. task_id 对应数据库的 task_id
3. video_url 对应数据库的 url
4. duration 对应数据库的 duration
5. start_time 对应数据库的 create_date
6. end_time 对应数据库的 update_date

请使用typeorm完成数据的新增去重工作

