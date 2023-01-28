import * as fs from 'fs'

export const saveToCsv = (filename, data) => {
	console.info('Конвертация в CSV …')
	const CSVString = objectsToCsv(data)

	fs.writeFile(filename, CSVString, error => {
		if (error) return console.error(error)
	})
	
	console.info(`Файл ${filename} успешно записан`)
}

const objectsToCsv = data => {
	let csvRows = []
	let headers = Object.keys(data[0])

	csvRows.push(headers.join(','))

	for (const row of data) {
		let values = headers.map(header => {
			let val = row[header]

			// Convert to string if array
			if (Array.isArray(val)) {
				let stringValue = ''
				val.forEach((value, index, array) => {
					// Get title by default
					stringValue += value.title
					if (index !== array.length - 1) stringValue += ', '
				})

				return `"${stringValue}"`
			}

			return `"${val}"`
		})

		csvRows.push(values.join(','))
	}

	return csvRows.join('\n')
}

export const dateFromString = dateTimeString => {
	const [dateString, timeString] = dateTimeString.split(' ')
	const [day, month, year] = dateString.split('.')
	const [hours, minutes] = timeString.split(':')

	const date = new Date(year, month - 1, day, hours, minutes, 0)

	return date
}
